import { EXTENSIONS, ProfileDocumentNode } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import createDebug from 'debug';
import {
  basename,
  join as joinPath,
  normalize,
  relative as relativePath,
} from 'path';

import {
  composeVersion,
  META_FILE,
  parseProfileDocument,
  SUPER_PATH,
  SUPERFACE_DIR,
  trimExtension,
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
import { ProfileId } from '../common/profile';
import { arrayFilterUndefined } from '../common/util';
import {
  generateTypesFile,
  generateTypingsForProfile,
  transpileFiles,
} from './generate';

const installDebug = createDebug('superface:install');

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

export type LocalRequest = {
  kind: 'local';
  path: string;
};
type LocalRequestRead = LocalRequest & {
  profileId: ProfileId;
  profileAst: ProfileDocumentNode;
};
type LocalRequestChecked = LocalRequestRead;

type StoreRequestVersionKnown = {
  kind: 'store';
  profileId: ProfileId;
  version: string;
};
type StoreRequestVersionUnknown = {
  kind: 'store';
  profileId: ProfileId;
  version: undefined;
};
export type StoreRequest =
  | StoreRequestVersionKnown
  | StoreRequestVersionUnknown;

type StoreRequestChecked = StoreRequestVersionKnown & {
  sourcePath: string;
};
type StoreRequestDeferredCheck = StoreRequestVersionUnknown;
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
 *     - if has "file" with different path - issue warning, require force flag
 *     - if has "version" - issue warning, require force flag
 *     - if not present - continue install
 *   - store request:
 *     - if has "file" - issue warning, require force flag
 *     - if has "version" and request specifies version - issue warning, require force flag if target file exists
 *     - if has "version" and request does not specify version - defer file existence check
 *     - if not present - continue install
 * 3. resolve store:
 *   - store requests:
 *     - requests are performed over network
 *     - requests which did not have version field - issue warning, require force flag if target file exists (basically repeat phase 2)
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
      installDebug('Install phase 1:', request);
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
        installDebug('Install phase 2:', request);
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
      installDebug('Install phase 3:', request);
      if (request.kind === 'store') {
        return fetchStoreRequestCheckedOrDeferred(superJson, request, options);
      }

      return request;
    })
  ).then(arrayFilterUndefined);

  // phase 4 - write to super.json
  for (const entry of phase3) {
    installDebug('Install phase 4:', entry);
    if (entry.kind === 'local') {
      superJson.mergeProfile(entry.profileId.id, {
        file: superJson.relativePath(entry.path),
      });
    } else {
      superJson.mergeProfile(entry.profileId.id, {
        version: entry.info.profile_version,
      });
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
    sources[joinPath('types', request.profileId.id + '.ts')] = typing;
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

    // TODO: this should be extracted from the file header or not needed at all
    const profileIdStr = trimExtension(basename(request.path));
    const profileId = ProfileId.fromId(profileIdStr);

    const profileAst = await Parser.parseProfile(profileSource, request.path, {
      profileName: profileId.name,
      scope: profileId.scope,
    });

    return {
      ...request,
      // make sure to take the id from the ast
      profileId: ProfileId.fromScopeName(
        profileAst.header.scope,
        profileAst.header.name
      ),
      profileAst,
    };
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    options?.warnCb?.(`Could not read profile file ${request.path}: ${err}`);

    return undefined;
  }
}

/**
 * Checks local request that has been read against super.json.
 *
 * Warns when the profile has already been installed from the same path.
 * Requires force flag to overwrite an existing installed profile.
 */
async function checkLocalRequestRead(
  superJson: SuperJson,
  request: LocalRequestRead,
  options?: InstallOptions
): Promise<LocalRequestChecked | undefined> {
  const profileSettings = superJson.normalized.profiles[request.profileId.id];
  if (profileSettings === undefined) {
    return request;
  }

  if ('file' in profileSettings) {
    if (relativePath(profileSettings.file, request.path) === '') {
      options?.warnCb?.(
        `Profile ${request.profileId.id} already installed from the same path: "${request.path}". Skipping.`
      );

      return undefined;
    }
  }

  if (options?.force !== true) {
    options?.warnCb?.(
      `Profile ${request.profileId.id} already installed from a different path: "${request.path}". Pass \`--force\` to override.`
    );

    return undefined;
  }

  return request;
}

/**
 * Checks store request against super.json.
 *
 * If the save path cannot be deduced at this point the check is deferred until the fetch happens.
 * The save path cannot be deduced if no version was provided to the install command.
 *
 * If the save path can be deduced because version was provided or if super.json specifies a file then require force flag to override.
 */
async function checkStoreRequest(
  superJson: SuperJson,
  request: StoreRequestVersionKnown,
  options?: InstallOptions
): Promise<StoreRequestChecked | undefined>;
async function checkStoreRequest(
  superJson: SuperJson,
  request: StoreRequestVersionUnknown,
  options?: InstallOptions
): Promise<StoreRequestDeferredCheck | undefined>;
async function checkStoreRequest(
  superJson: SuperJson,
  request: StoreRequest,
  options?: InstallOptions
): Promise<StoreRequestChecked | StoreRequestDeferredCheck | undefined>;
async function checkStoreRequest(
  superJson: SuperJson,
  request: StoreRequest,
  options?: InstallOptions
): Promise<StoreRequestChecked | StoreRequestDeferredCheck | undefined> {
  const profileSettings = superJson.normalized.profiles[request.profileId.id];

  // Defer the check. This function will be called again once version is known.
  if (request.version === undefined) {
    return {
      ...request,
      version: undefined,
    };
  }

  // check if we aren't overwriting something in super.json
  if (profileSettings !== undefined && options?.force !== true) {
    if ('file' in profileSettings) {
      options?.warnCb?.(
        `Profile ${request.profileId.id} already installed from a path: "${profileSettings.file}". Pass \`--force\` to override.`
      );

      return undefined;
    }

    if (
      'version' in profileSettings &&
      request.version !== profileSettings.version
    ) {
      options?.warnCb?.(
        `Profile ${request.profileId.id} already installed with version: ${profileSettings.version}. Pass \`--force\` to override.`
      );

      return undefined;
    }
  }

  // construct source path and check if we aren't overwriting a file there
  const sourcePath = superJson.resolvePath(
    joinPath(
      'grid',
      `${request.profileId.id}@${request.version}${EXTENSIONS.profile.source}`
    )
  );
  if (await exists(sourcePath)) {
    if (options?.force !== true) {
      options?.warnCb?.(
        `Target file already exists: "${sourcePath}". Pass \`--force\` to override.`
      );

      return undefined;
    }
  }

  // if we've gotten this far then either we aren't overwriting anything or the force flag is present
  return {
    ...request,
    sourcePath,
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
    request.profileId.id,
    request.version,
    options
  );
  if (fetched === undefined) {
    return undefined;
  }

  // run the deferred check, resolve paths
  if (!('sourcePath' in request)) {
    const checked = await checkStoreRequest(
      superJson,
      {
        ...request,
        version: fetched.info.profile_version,
      },
      options
    );

    if (checked === undefined) {
      return undefined;
    }

    request = checked;
  }

  // save the downloaded data
  try {
    await OutputStream.writeOnce(request.sourcePath, fetched.profile, {
      dirs: true,
    });
    options?.logCb?.(
      formatShellLog("echo '<profile>' >", [request.sourcePath])
    );
  } catch (err) {
    options?.warnCb?.(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Could not write profile ${request.profileId.id} source: ${err}`
    );

    return undefined;
  }

  // cache the profile
  await Parser.parseProfile(fetched.profile, request.profileId.id, {
    profileName: request.profileId.name,
    scope: request.profileId.scope,
  });

  return {
    ...request,
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
): Promise<{ profileId: ProfileId; version: string }[]> {
  return Promise.all(
    Object.entries(superJson.normalized.profiles).map(
      async ([profileIdStr, profileSettings]) => {
        const profileId = ProfileId.fromId(profileIdStr);

        if ('version' in profileSettings) {
          return {
            profileId,
            version: profileSettings.version,
          };
        }

        if ('file' in profileSettings) {
          try {
            //TODO: we could get ast here
            const { header } = await parseProfileDocument(
              superJson.resolvePath(profileSettings.file)
            );

            return {
              profileId: ProfileId.fromScopeName(header.scope, header.name),
              version: composeVersion(header.version),
            };
          } catch (err) {
            options?.warnCb?.(
              `No version for profile ${profileId.id} was found, returning default version 1.0.0`
            );
          }
        }

        // default
        return {
          profileId,
          version: '1.0.0',
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
      parameters.options?.warnCb?.(err.formatLong());

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
      ({ profileId, version }) => ({
        kind: 'store',
        profileId,
        version,
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
