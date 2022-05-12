import { EXTENSIONS, ProfileDocumentNode } from '@superfaceai/ast';
import { Parser, SuperJson } from '@superfaceai/one-sdk';
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
  SUPER_PATH,
  SUPERFACE_DIR,
  trimExtension,
} from '../common/document';
import { UserError } from '../common/error';
import {
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
  ProfileInfo,
} from '../common/http';
import { exists, isAccessible, readFile } from '../common/io';
import { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { resolveSuperfaceRelatedPath } from '../common/path';
import { ProfileId } from '../common/profile';
import { arrayFilterUndefined } from '../common/util';

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
  force?: boolean;
  tryToAuthenticate?: boolean;
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
  {
    superJson,
    requests,
    options,
  }: {
    superJson: SuperJson;
    requests: (LocalRequest | StoreRequest)[];
    options?: InstallOptions;
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<number> {
  // phase 1 - read local requests
  const phase1 = await Promise.all(
    requests.map(async request => {
      installDebug('Install phase 1:', request);
      if (request.kind === 'local') {
        return readLocalRequest(superJson, request, { logger, userError });
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
          return checkLocalRequestRead(
            { superJson, request, options },
            { logger }
          );
        } else {
          return checkStoreRequest({ superJson, request, options }, { logger });
        }
      }
    )
  ).then(arrayFilterUndefined);

  // phase 3 - fetch from store
  const phase3 = await Promise.all(
    phase2.map(async request => {
      installDebug('Install phase 3:', request);
      if (request.kind === 'store') {
        return fetchStoreRequestCheckedOrDeferred(
          { superJson, request, options },
          { logger }
        );
      }

      return request;
    })
  ).then(arrayFilterUndefined);

  // phase 4 - write to super.json
  for (const entry of phase3) {
    installDebug('Install phase 4:', entry);
    if (entry.kind === 'local') {
      superJson.mergeProfile(entry.profileId.id, {
        file: resolveSuperfaceRelatedPath(entry.path, superJson),
      });
    } else {
      superJson.mergeProfile(entry.profileId.id, {
        version: entry.info.profile_version,
      });
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
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<LocalRequestRead | undefined> {
  try {
    const profileSource = await readFile(request.path, { encoding: 'utf-8' });

    // TODO: this should be extracted from the file header or not needed at all
    const profileIdStr = trimExtension(basename(request.path), { userError });
    const profileId = ProfileId.fromId(profileIdStr, { userError });

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
    logger.warn('couldNotReadProfile', request.path, err);

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
  {
    superJson,
    request,
    options,
  }: {
    superJson: SuperJson;
    request: LocalRequestRead;
    options?: InstallOptions;
  },
  { logger }: { logger: ILogger }
): Promise<LocalRequestChecked | undefined> {
  const profileSettings = superJson.normalized.profiles[request.profileId.id];
  if (profileSettings === undefined) {
    return request;
  }

  if ('file' in profileSettings) {
    if (relativePath(profileSettings.file, request.path) === '') {
      logger.warn(
        'profileInstalledFromSamePath',
        request.profileId.id,
        request.path
      );

      return undefined;
    }
  }

  if (options?.force !== true) {
    logger.warn('profileInstalledFromPath', request.profileId.id, request.path);

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
  {
    superJson,
    request,
    options,
  }: {
    superJson: SuperJson;
    request: StoreRequestVersionKnown;
    options?: InstallOptions;
  },
  { logger }: { logger: ILogger }
): Promise<StoreRequestChecked | undefined>;
async function checkStoreRequest(
  {
    superJson,
    request,
    options,
  }: {
    superJson: SuperJson;
    request: StoreRequestVersionUnknown;
    options?: InstallOptions;
  },
  { logger }: { logger: ILogger }
): Promise<StoreRequestDeferredCheck | undefined>;
async function checkStoreRequest(
  {
    superJson,
    request,
    options,
  }: {
    superJson: SuperJson;
    request: StoreRequest;
    options?: InstallOptions;
  },
  { logger }: { logger: ILogger }
): Promise<StoreRequestChecked | StoreRequestDeferredCheck | undefined>;
async function checkStoreRequest(
  {
    superJson,
    request,
    options,
  }: {
    superJson: SuperJson;
    request: StoreRequest;
    options?: InstallOptions;
  },
  { logger }: { logger: ILogger }
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
      logger.error(
        'profileInstalledFromPath',
        request.profileId.id,
        profileSettings.file
      );

      return undefined;
    }

    if (
      'version' in profileSettings &&
      request.version !== profileSettings.version
    ) {
      logger.error(
        'profileInstalledWithVersion',
        request.profileId.id,
        request.version
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
      logger.error('fileAlreadyExists', sourcePath);

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
  {
    profileId,
    version,
    options,
  }: {
    profileId: ProfileId;
    version?: string;
    options?: {
      tryToAuthenticate?: boolean;
    };
  },
  { logger }: { logger: ILogger }
): Promise<ProfileResponse | undefined> {
  const profileIdStr = profileId.withVersion(version);

  // fetch the profile
  let info: ProfileInfo;
  let profile: string;
  let ast: ProfileDocumentNode;
  logger.info('fetchProfile', profileIdStr);

  try {
    info = await fetchProfileInfo(profileId, version, {
      tryToAuthenticate: options?.tryToAuthenticate,
    });
    logger.info('fetchProfileInfo', profileIdStr);

    profile = await fetchProfile(profileId, version, {
      tryToAuthenticate: options?.tryToAuthenticate,
    });
    logger.info('fetchProfileSource', profileIdStr);

    try {
      //This can fail due to validation issues, ast and parser version issues
      ast = await fetchProfileAST(profileId, version, {
        tryToAuthenticate: options?.tryToAuthenticate,
      });
      logger.info('fetchProfileAst', profileIdStr);
    } catch (error) {
      logger.warn('fetchProfileAstFailed', profileIdStr);
      //We try to parse profile on our own
      ast = await Parser.parseProfile(profile, profileIdStr, {
        profileName: profileId.name,
        scope: profileId.scope,
      });
    }
  } catch (error) {
    logger.error('couldNotFetch', profileIdStr, error);

    return undefined;
  }

  return {
    info,
    profile,
    ast,
  };
}

async function fetchStoreRequestCheckedOrDeferred(
  {
    superJson,
    request,
    options,
  }: {
    superJson: SuperJson;
    request: StoreRequestChecked | StoreRequestDeferredCheck;
    options?: InstallOptions;
  },
  { logger }: { logger: ILogger }
): Promise<StoreRequestFetched | undefined> {
  const fetched = await getProfileFromStore(
    {
      profileId: request.profileId,
      version: request.version,
      options,
    },
    { logger }
  );
  if (fetched === undefined) {
    return undefined;
  }

  // run the deferred check, resolve paths
  if (!('sourcePath' in request)) {
    const checked = await checkStoreRequest(
      {
        superJson,
        request: {
          ...request,
          version: fetched.info.profile_version,
        },
        options,
      },
      { logger }
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
    logger.info('writeProfile', request.sourcePath);
  } catch (err) {
    logger.error('unableToWriteProfile', request.profileId.id, err);

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
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<{ profileId: ProfileId; version: string }[]> {
  return Promise.all(
    Object.entries(superJson.normalized.profiles).map(
      async ([profileIdStr, profileSettings]) => {
        const profileId = ProfileId.fromId(profileIdStr, { userError });

        if ('version' in profileSettings) {
          return {
            profileId,
            version: profileSettings.version,
          };
        }

        if ('file' in profileSettings) {
          try {
            const filePath = superJson.resolvePath(profileSettings.file);
            const content = await readFile(filePath, { encoding: 'utf-8' });
            const { header } = await Parser.parseProfile(content, filePath, {
              profileName: profileId.name,
              scope: profileId.scope,
            });

            return {
              profileId: ProfileId.fromScopeName(header.scope, header.name),
              version: composeVersion(header.version),
            };
          } catch (err) {
            logger.error('noVersionForProfile', profileId.id);
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
export async function installProfiles(
  {
    superPath,
    requests,
    options,
  }: {
    superPath: string;
    requests: (LocalRequest | StoreRequest)[];
    options?: InstallOptions;
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<{ continueWithInstall: boolean }> {
  const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
  if (loadedResult.isErr()) {
    logger.error('errorMessage', loadedResult.error.formatLong());

    return { continueWithInstall: false };
  }
  const superJson = loadedResult.value;

  // gather requests if empty
  if (requests.length === 0) {
    const existingProfileIds = await getExistingProfileIds(superJson, {
      logger,
      userError,
    });
    requests = existingProfileIds.map<StoreRequest>(
      ({ profileId, version }) => ({
        kind: 'store',
        profileId,
        version,
      })
    );
  }

  const installed = await resolveInstallationRequests(
    {
      superJson,
      requests,
      options,
    },
    { logger, userError }
  );

  if (installed > 0) {
    // save super.json
    await OutputStream.writeOnce(superJson.path, superJson.stringified);
    logger.info('updateSuperJson', superJson.path);
  }

  const toInstall = requests.length;
  if (toInstall > 0) {
    if (installed === 0) {
      logger.warn('noProfilesInstalled');
    } else if (installed < toInstall) {
      logger.warn(
        'xOutOfYInstalled',
        installed.toString(),
        toInstall.toString()
      );
    } else {
      logger.success('allProfilesInstalled', installed.toString());
    }
  } else {
    logger.info('noProfilesFound');
  }

  return { continueWithInstall: true };
}
