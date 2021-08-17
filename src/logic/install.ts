import { ProfileDocumentNode } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath, normalize, relative as relativePath } from 'path';

import {
  composeVersion,
  EXTENSIONS,
  META_FILE,
  parseProfileDocument,
  SUPER_PATH,
  SUPERFACE_DIR,
  UNCOMPILED_SDK_FILE,
} from '../common/document';
import {
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
  ProfileInfo,
} from '../common/http';
import { exists, isAccessible, readFile } from '../common/io';
import { formatShellLog, LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { Parser } from '../common/parser';
import { pathParentLevel } from '../common/path';
import { arrayFilterUndefined } from '../common/util';
import {
  generateTypesFile,
  generateTypingsForProfile,
  transpileFiles,
} from './generate';

const INSTALL_LOCAL_PATH_PARENT_LIMIT = (() => {
  let value = 1;

  const env = process.env['INSTALL_LOCAL_PATH_PARENT_LIMIT'];
  if (env !== undefined) {
    try {
      value = parseInt(env);
    } catch (_) {
      // pass
    }
  }

  return value;
})();

/**
 * Detects the existence of a `super.json` file in specified number of levels
 * of parent directories.
 *
 * @param cwd - currently scanned working directory
 *
 * Returns relative path to a directory where `super.json` is detected.
 */
export async function detectSuperJson(
  cwd: string,
  level?: number
): Promise<string | undefined> {
  // check whether super.json is accessible in cwd
  if (await isAccessible(joinPath(cwd, META_FILE))) {
    return normalize(relativePath(process.cwd(), cwd));
  }

  // check whether super.json is accessible in cwd/superface
  if (await isAccessible(joinPath(cwd, SUPER_PATH))) {
    return normalize(relativePath(process.cwd(), joinPath(cwd, SUPERFACE_DIR)));
  }

  // default behaviour - do not scan outside cwd
  if (level === undefined || level < 1) {
    return undefined;
  }

  // check if user has permissions outside cwd
  cwd = joinPath(cwd, '..');
  if (!(await isAccessible(cwd))) {
    return undefined;
  }

  return await detectSuperJson(cwd, --level);
}

type InstallOptions = {
  logCb?: LogCallback;
  warnCb?: LogCallback;
  force?: boolean;
};

type RequestBase = {
  profileName: string;
  scope?: string;
  version?: string;
};

export type LocalRequest = RequestBase & {
  kind: 'local';
  path: string;
};
type LocalRequestRead = LocalRequest & {
  profileId: string;
  profileAst: ProfileDocumentNode;
};
type LocalRequestChecked = LocalRequestRead;

export type StoreRequest = RequestBase & {
  kind: 'store';
  profileId: string;
  version?: string;
};
type StoreRequestChecked = StoreRequest & {
  sourcePath: string;
  // astPath: string;
  pathOutsideGrid: boolean;
};
type StoreRequestDeferredCheck = StoreRequest & { version: undefined } & {
  pathOutsideGrid: false;
};
type StoreRequestFetched = StoreRequestChecked & {
  info: ProfileInfo;
  profileSource: string;
  profileAst: ProfileDocumentNode;
};

/**
 * Installation request resolution sequence:
 * 1. resolve local:
 *   - local requests:
 *     - attempt to read and parse source files, get profileId from the profile header
 * 2. check super.json:
 *   - local request:
 *     - if has "file" with the same path - issue a warning, don't install
 *     - if has "file" with different path - continue install
 *     - if has "version" - continue install
 *     - if not present - continue install
 *   - store request:
 *     - if has "file" - do limit check, require force flag if target file exists
 *     - if has "version" and request specifies version - require force flag if target file exists
 *     - if has "version" and request does not specify version - defer file existence check
 *     - if not present - continue install
 * 3. resolve store:
 *   - store requests:
 *     - requests are performed over network
 *     - requests which did not have version field - require force flag if target file exists
 *     - write downloaded files
 * 4. write:
 *   - write entries into super.json
 * 5. generate type:
 *   - generate types and write then to superface/sdk.js/.d.ts and superface/types/
 */
export async function resolveInstallationRequests(
  superJson: SuperJson,
  requests: (LocalRequest | StoreRequest)[],
  options?: InstallOptions
): Promise<number> {
  // phase 1 - read local requests
  const phase1 = await Promise.all(
    requests.map(async request => {
      if (request.kind === 'local') {
        return readLocalRequest(superJson, request, options);
      }

      return request;
    })
  ).then(arrayFilterUndefined);

  // phase 2 - check against super.json
  const phase2 = await Promise.all(
    phase1.map(
      (
        request
      ): Promise<
        | LocalRequestChecked
        | StoreRequestChecked
        | StoreRequestDeferredCheck
        | undefined
      > => {
        if (request.kind === 'local') {
          return checkLocalRequestRead(superJson, request, options);
        } else {
          return checkStoreRequest(superJson, request, options);
        }
      }
    )
  ).then(arrayFilterUndefined);

  // phase 3 - fetch from store
  const phase3 = await Promise.all(
    phase2.map(async request => {
      if (request.kind === 'store') {
        return fetchStoreRequestCheckedOrDeferred(superJson, request, options);
      }

      return request;
    })
  ).then(arrayFilterUndefined);

  // phase 4 - write to super.json
  for (const entry of phase3) {
    if (entry.kind === 'local') {
      superJson.addProfile(entry.profileId, {
        file: superJson.relativePath(entry.path),
      });
    } else {
      if (entry.pathOutsideGrid) {
        superJson.addProfile(entry.profileId, {
          file: superJson.relativePath(entry.sourcePath),
        });
      } else {
        superJson.addProfile(entry.profileId, {
          version: entry.info.profile_version,
        });
      }
    }
  }

  // phase 5 - generate types
  await generateTypes(phase3, superJson);

  return phase3.length;
}

/**
 * Generates types from Profile requests and writes them in superface directory
 */
async function generateTypes(
  requests: (LocalRequestRead | StoreRequestFetched)[],
  superJson: SuperJson
) {
  const sources: Record<string, string> = {};
  for (const request of requests) {
    const typing = generateTypingsForProfile(request.profileAst);
    sources[joinPath('types', request.profileId + '.ts')] = typing;
  }
  const sdkFile = generateTypesFile(Object.keys(superJson.normalized.profiles));
  sources[UNCOMPILED_SDK_FILE] = sdkFile;
  await transpileFiles(sources, superJson);
}

/**
 * Reads the profile file from a local installation request.
 */
async function readLocalRequest(
  _superJson: SuperJson,
  request: LocalRequest,
  options?: InstallOptions
): Promise<LocalRequestRead | undefined> {
  try {
    const profileSource = await readFile(request.path, { encoding: 'utf-8' });
    const profileAst = await Parser.parseProfile(profileSource, request.path, {
      profileName: request.profileName,
      scope: request.scope,
    });

    return {
      ...request,
      profileId:
        profileAst.header.scope !== undefined
          ? `${profileAst.header.scope}/${profileAst.header.name}`
          : profileAst.header.name,
      profileAst,
    };
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    options?.warnCb?.(`Could not read profile file ${request.path}: ${err}`);

    return undefined;
  }
}

/**
 * Checks local request that has been read against super.json and warns when the profile has already been installed from the same path.
 */
async function checkLocalRequestRead(
  superJson: SuperJson,
  request: LocalRequestRead,
  options?: InstallOptions
): Promise<LocalRequestChecked | undefined> {
  const profileSettings = superJson.normalized.profiles[request.profileId];
  if (profileSettings === undefined) {
    return request;
  }

  if ('file' in profileSettings) {
    if (relativePath(profileSettings.file, request.path) === '') {
      options?.warnCb?.(
        `Profile ${request.profileId} already installed from the same path: ${request.path}`
      );

      return undefined;
    }
  }

  return request;
}

/**
 * Creates a path based on profileId and version, performs existence check.
 */
async function checkStoreRequestGridPathHelper(
  superJson: SuperJson,
  profileId: string,
  version: string,
  options?: InstallOptions
): Promise<{ sourcePath: string } | undefined> {
  const path = joinPath(
    'grid',
    `${profileId}@${version}${EXTENSIONS.profile.source}`
  );
  const sourcePath = superJson.resolvePath(path);
  // const astPath = replaceExt(sourcePath, EXTENSIONS.profile.build);

  if (options?.force !== true && (await exists(sourcePath))) {
    options?.warnCb?.(
      `File already exists: "${sourcePath}" (Use flag \`--force/-f\` to overwrite)`
    );

    return undefined;
  }

  return { sourcePath };
}

/**
 * Checks store request against super.json. If the save path cannot be deduced at this point the check is deferred until the fetch happens.
 *
 * The save path cannot be deduced if the entry does not yet exist in super.json and no version was provided to the install command.
 */
async function checkStoreRequest(
  superJson: SuperJson,
  request: StoreRequest,
  options?: InstallOptions
): Promise<StoreRequestChecked | StoreRequestDeferredCheck | undefined> {
  const profileSettings = superJson.normalized.profiles[request.profileId];

  // super.json specifies `file`
  if (profileSettings !== undefined && 'file' in profileSettings) {
    const sourcePath = superJson.resolvePath(profileSettings.file);
    //TODO: remove or point to .cahce
    // const astPath = replaceExt(sourcePath, EXTENSIONS.profile.build);

    if (pathParentLevel(sourcePath) > INSTALL_LOCAL_PATH_PARENT_LIMIT) {
      options?.warnCb?.(
        `Invalid path: "${profileSettings.file}" (Installation path must not be further up in the filesystem tree than ${INSTALL_LOCAL_PATH_PARENT_LIMIT} levels; use \`INSTALL_LOCAL_PATH_PARENT_LIMIT\` env variable to override)`
      );

      return undefined;
    }

    if (options?.force !== true && (await exists(sourcePath))) {
      options?.warnCb?.(
        `File already exists: "${sourcePath}" (Use flag \`--force/-f\` to overwrite)`
      );

      return undefined;
    }

    return {
      ...request,
      kind: 'store',
      profileId: request.profileId,
      version: request.version,
      sourcePath,
      // astPath,
      pathOutsideGrid: true,
    };
  }

  // check must be deferred
  if (request.version === undefined) {
    return {
      ...request,
      kind: 'store',
      profileId: request.profileId,
      version: undefined,
      pathOutsideGrid: false,
    };
  }

  // super.json specifies version, or doesn't exist
  const paths = await checkStoreRequestGridPathHelper(
    superJson,
    request.profileId,
    request.version,
    options
  );
  if (paths === undefined) {
    return undefined;
  }

  return {
    ...request,
    kind: 'store',
    profileId: request.profileId,
    version: request.version,
    pathOutsideGrid: false,
    sourcePath: paths.sourcePath,
    // astPath: paths.astPath,
  };
}

export type ProfileResponse = {
  info: ProfileInfo;
  profile: string;
  ast: ProfileDocumentNode;
};
export async function getProfileFromStore(
  profileId: string,
  version?: string,
  options?: { logCb?: LogCallback; warnCb?: LogCallback }
): Promise<ProfileResponse | undefined> {
  if (version !== undefined) {
    profileId = `${profileId}@${version}`;
  }

  // fetch the profile
  let info: ProfileInfo;
  let profile: string;
  let ast: ProfileDocumentNode;
  options?.logCb?.(`\nFetching profile ${profileId} from the Store`);

  try {
    info = await fetchProfileInfo(profileId);
    options?.logCb?.(`GET Profile Info ${profileId}`);

    profile = await fetchProfile(profileId);
    options?.logCb?.(`GET Profile Source File ${profileId}`);

    ast = await fetchProfileAST(profileId);
    options?.logCb?.(`GET compiled Profile ${profileId}`);
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    options?.warnCb?.(`Could not fetch ${profileId}: ${error}`);

    return undefined;
  }

  return {
    info,
    profile,
    ast,
  };
}

async function fetchStoreRequestCheckedOrDeferred(
  superJson: SuperJson,
  request: StoreRequestChecked | StoreRequestDeferredCheck,
  options?: InstallOptions
): Promise<StoreRequestFetched | undefined> {
  const fetched = await getProfileFromStore(
    request.profileId,
    request.version,
    options
  );
  if (fetched === undefined) {
    return undefined;
  }

  // run the deferred check, resolve paths
  let sourcePath;
  // let astPath;
  if (!('sourcePath' in request)) {
    const paths = await checkStoreRequestGridPathHelper(
      superJson,
      request.profileId,
      fetched.info.profile_version,
      options
    );
    if (paths === undefined) {
      return undefined;
    }

    sourcePath = paths.sourcePath;
  } else {
    sourcePath = request.sourcePath;
  }

  // save the downloaded data
  try {
    await OutputStream.writeOnce(sourcePath, fetched.profile, { dirs: true });
    options?.logCb?.(formatShellLog("echo '<profile>' >", [sourcePath]));
  } catch (err) {
    options?.warnCb?.(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Could not write profile ${request.profileId} source: ${err}`
    );

    return undefined;
  }

  await Parser.parseProfile(fetched.profile, request.profileId, {
    profileName: request.profileName,
    scope: request.scope,
  });

  return {
    ...request,
    kind: 'store',
    profileId: request.profileId,
    version: request.version,
    sourcePath,
    pathOutsideGrid: request.pathOutsideGrid,
    info: fetched.info,
    profileSource: fetched.profile,
    profileAst: fetched.ast,
  };
}

/**
 * Extracts profile ids from `super.json`.
 */
export async function getExistingProfileIds(
  superJson: SuperJson,
  options?: {
    warnCb?: LogCallback;
  }
): Promise<
  { profileId: string; version: string; profileName: string; scope?: string }[]
> {
  return Promise.all(
    Object.entries(superJson.normalized.profiles).map(
      async ([profileId, profileSettings]) => {
        const profilePathParts = profileId.split('/');

        if ('version' in profileSettings) {
          return {
            profileId,
            version: profileSettings.version,
            profileName: profilePathParts[profilePathParts.length - 1],
            scope: profilePathParts[0],
          };
        }

        if ('file' in profileSettings) {
          try {
            //TODO: we could get ast here
            const { header } = await parseProfileDocument(
              superJson.resolvePath(profileSettings.file)
            );

            return {
              profileId,
              version: composeVersion(header.version),
              scope: header.scope,
              profileName: header.name,
            };
          } catch (err) {
            options?.warnCb?.(
              `No version for profile ${profileId} was found, returning default version 1.0.0`
            );
          }
        }

        // default
        return {
          profileId,
          version: '1.0.0',
          profileName: profilePathParts[profilePathParts.length - 1],
          scope: profilePathParts[0],
        };
      }
    )
  );
}

/**
 * Installs profiles with optional providers.
 *
 * If `request` is not undefined it is resolved and installed.
 *
 * If `request` is undefined store requests are generated for each profile in super.json and
 * then resolved as normal (i.e. redownloads all profiles from the store).
 */
export async function installProfiles(parameters: {
  superPath: string;
  requests: (LocalRequest | StoreRequest)[];
  options?: InstallOptions;
}): Promise<void> {
  const loadedResult = await SuperJson.load(
    joinPath(parameters.superPath, META_FILE)
  );
  const superJson = loadedResult.match(
    v => v,
    err => {
      parameters.options?.warnCb?.(err);

      return new SuperJson({});
    }
  );

  // gather requests if empty
  if (parameters.requests.length === 0) {
    const existingProfileIds = await getExistingProfileIds(
      superJson,
      parameters.options
    );
    parameters.requests = existingProfileIds.map<StoreRequest>(
      ({ profileId, version, scope, profileName }) => ({
        kind: 'store',
        profileId,
        version,
        scope,
        profileName,
      })
    );
  }

  const installed = await resolveInstallationRequests(
    superJson,
    parameters.requests,
    parameters.options
  );

  if (installed > 0) {
    // save super.json
    await OutputStream.writeOnce(superJson.path, superJson.stringified);
    parameters.options?.logCb?.(
      formatShellLog("echo '<updated super.json>' >", [superJson.path])
    );
  }

  const toInstall = parameters.requests.length;
  if (toInstall > 0) {
    if (installed === 0) {
      parameters.options?.logCb?.(`❌ No profiles have been installed`);
    } else if (installed < toInstall) {
      parameters.options?.logCb?.(
        `⚠️ Installed ${installed} out of ${toInstall} profiles`
      );
    } else {
      parameters.options?.logCb?.(
        `🆗 All profiles (${installed}) have been installed successfully.`
      );
    }
  } else {
    parameters.options?.logCb?.(`No profiles found to install`);
  }
}
