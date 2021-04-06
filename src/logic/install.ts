import { ProfileDocumentNode } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/sdk';
import { join as joinPath, normalize, relative as relativePath } from 'path';

import {
  composeVersion,
  EXTENSIONS,
  getProfileDocument,
  META_FILE,
  SUPER_PATH,
  SUPERFACE_DIR,
} from '../common/document';
import {
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
  ProfileInfo,
} from '../common/http';
import { exists, isAccessible } from '../common/io';
import { formatShellLog, LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { pathParentLevel, replaceExt } from '../common/path';

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

export type LocalRequest = {
  kind: 'local';
  path: string;
};
type LocalRequestRead = LocalRequest & {
  profileId: string;
};
type LocalRequestChecked = LocalRequestRead;

export type StoreRequest = {
  kind: 'store';
  profileId: string;
  version?: string;
};
type StoreRequestChecked = StoreRequest & {
  sourcePath: string;
  astPath: string;
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

function filterUndefined<T>(array: T[]): Exclude<T, undefined>[] {
  return array.filter((v): v is Exclude<T, undefined> => v !== undefined);
}

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
  ).then(filterUndefined);

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
  ).then(filterUndefined);

  // phase 3 - fetch from store
  const phase3 = await Promise.all(
    phase2.map(async request => {
      if (request.kind === 'store') {
        return fetchStoreRequestCheckedOrDeferred(superJson, request, options);
      }

      return request;
    })
  ).then(filterUndefined);

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

  return phase3.length;
}

/**
 * Reads the profile file from a local installation request.
 */
async function readLocalRequest(
  _superJson: SuperJson,
  request: LocalRequest,
  options?: InstallOptions
): Promise<LocalRequestRead | undefined> {
  let header;
  try {
    const profile = await getProfileDocument(request.path);
    header = profile.header;
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    options?.warnCb?.(`Could not read profile file ${request.path}: ${err}`);

    return undefined;
  }

  return {
    ...request,
    profileId:
      header.scope !== undefined
        ? `${header.scope}/${header.name}`
        : header.name,
  };
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
): Promise<{ sourcePath: string; astPath: string } | undefined> {
  const relativePath = joinPath(
    'grid',
    `${profileId}@${version}${EXTENSIONS.profile.source}`
  );
  const sourcePath = superJson.resolvePath(relativePath);
  const astPath = replaceExt(sourcePath, EXTENSIONS.profile.build);

  if (options?.force !== true && (await exists(sourcePath))) {
    options?.warnCb?.(
      `File already exists: "${sourcePath}" (Use flag \`--force/-f\` to overwrite)`
    );

    return undefined;
  }

  return { sourcePath, astPath };
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
    const astPath = replaceExt(sourcePath, EXTENSIONS.profile.build);

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
      kind: 'store',
      profileId: request.profileId,
      version: request.version,
      sourcePath,
      astPath,
      pathOutsideGrid: true,
    };
  }

  // check must be deferred
  if (request.version === undefined) {
    return {
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
    kind: 'store',
    profileId: request.profileId,
    version: request.version,
    pathOutsideGrid: false,
    sourcePath: paths.sourcePath,
    astPath: paths.astPath,
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
    options?.logCb?.(`GET Profile AST ${profileId}`);
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
  let astPath;
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
    astPath = paths.astPath;
  } else {
    sourcePath = request.sourcePath;
    astPath = request.astPath;
  }

  // save the downloaded data
  try {
    await OutputStream.writeOnce(sourcePath, fetched.profile, { dirs: true });
    options?.logCb?.(formatShellLog("echo '<profile>' >", [sourcePath]));
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    options?.warnCb?.(
      `Could not write profile ${request.profileId} source: ${err}`
    );

    return undefined;
  }

  try {
    await OutputStream.writeOnce(
      astPath,
      JSON.stringify(fetched.ast, undefined, 2)
    );
    options?.logCb?.(formatShellLog("echo '<profileAST>' >", [astPath]));
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    options?.warnCb?.(
      `Could not write built profile ${request.profileId}: ${err}`
    );

    return undefined;
  }

  return {
    kind: 'store',
    profileId: request.profileId,
    version: request.version,
    sourcePath,
    astPath,
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
): Promise<{ profileId: string; version: string }[]> {
  return Promise.all(
    Object.entries(superJson.normalized.profiles).map(
      async ([profileId, profileSettings]) => {
        if ('version' in profileSettings) {
          return { profileId, version: profileSettings.version };
        }

        if ('file' in profileSettings) {
          try {
            const { header } = await getProfileDocument(
              superJson.resolvePath(profileSettings.file)
            );

            return { profileId, version: composeVersion(header.version) };
          } catch (err) {
            options?.warnCb?.(
              `No version for profile ${profileId} was found, returning default version 1.0.0`
            );
          }
        }

        // default
        return { profileId, version: '1.0.0' };
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
export async function installProfiles(
  superPath: string,
  requests: (LocalRequest | StoreRequest)[],
  options?: InstallOptions
): Promise<void> {
  const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
  const superJson = loadedResult.match(
    v => v,
    err => {
      options?.warnCb?.(err);

      return new SuperJson({});
    }
  );

  // gather requests if empty
  if (requests.length === 0) {
    const existingProfileIds = await getExistingProfileIds(superJson, options);
    requests = existingProfileIds.map<StoreRequest>(
      ({ profileId, version }) => ({ kind: 'store', profileId, version })
    );
  }

  const installed = await resolveInstallationRequests(
    superJson,
    requests,
    options
  );

  if (installed > 0) {
    // save super.json
    await OutputStream.writeOnce(superJson.path, superJson.stringified);
    options?.logCb?.(
      formatShellLog("echo '<updated super.json>' >", [superJson.path])
    );
  }

  const toInstall = requests.length;
  if (toInstall > 0) {
    if (installed === 0) {
      options?.logCb?.(`❌ No profiles have been installed`);
    } else if (installed < toInstall) {
      options?.logCb?.(
        `⚠️ Installed ${installed} out of ${toInstall} profiles`
      );
    } else {
      options?.logCb?.(
        `🆗 All profiles (${installed}) have been installed successfully.`
      );
    }
  } else {
    options?.logCb?.(`No profiles found to install`);
  }
}
