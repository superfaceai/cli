import { ProfileDocumentNode } from '@superfaceai/ast';
import { ProfileProviderEntry, SuperJson } from '@superfaceai/sdk';
import { join as joinPath, normalize, relative as relativePath } from 'path';

import {
  composeVersion,
  constructProfileProviderSettings,
  EXTENSIONS,
  getProfileDocument,
  META_FILE,
  SUPER_PATH,
  SUPERFACE_DIR,
} from '../common/document';
import { userError } from '../common/error';
import {
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
  ProfileInfo,
} from '../common/http';
import { exists, isAccessible } from '../common/io';
import { formatShellLog, LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';

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

export interface ProfileResponse {
  info: ProfileInfo;
  ast: ProfileDocumentNode;
  profile: string;
}

/**
 * Mock the Superface registry API GET call with calls to Store API.
 * Query the newest profile in valid scope (https://semver.org/)
 */
export async function getProfileFromStore(
  profileId: string,
  options?: {
    logCb?: LogCallback;
  }
): Promise<ProfileResponse> {
  options?.logCb?.(`Fetching profile ${profileId} from the Store`);

  try {
    const info = await fetchProfileInfo(profileId);
    options?.logCb?.('GET Profile Info');

    const profile = await fetchProfile(profileId);
    options?.logCb?.('GET Profile Source File');

    const ast = await fetchProfileAST(profileId);
    options?.logCb?.('GET Profile AST');

    return {
      info,
      ast,
      profile,
    };
  } catch (error) {
    throw userError(error, 1);
  }
}

/**
 * Returns a number of up levels one has to traverse from `base` to `path`.
 *
 * In practice, this is the number of starting `../` parts of the normalized relative path.
 */
function pathCommonParentLevel(path: string): number {
  let current = normalize(path);

  let number = 0;
  while (current.startsWith('../')) {
    current = current.slice('../'.length);
    number += 1;
  }

  return number;
}

/**
 * Handle responses from superface registry.
 * It saves profiles and its AST to grid folder and
 * it saves new information about profiles into super.json.
 */
export async function handleProfileResponses(
  superJson: SuperJson,
  responses: ProfileResponse[],
  profileProviders?: Record<string, ProfileProviderEntry>,
  options?: { logCb?: LogCallback; warnCb?: LogCallback; force: boolean }
): Promise<number> {
  let installed = 0;

  options?.logCb?.('Installing profiles');
  for (const response of responses) {
    options?.logCb?.(
      `${installed + 1}/${responses.length} installing ${
        response.info.profile_name
      }`
    );

    // prepare paths
    let relativePath = joinPath(
      'grid',
      `${response.info.profile_name}@${response.info.profile_version}${EXTENSIONS.profile.source}`
    );
    let actualPath = superJson.resolvePath(relativePath);

    // resolve paths already in super.json if present
    const profileSettings =
      superJson.normalized.profiles[response.info.profile_name];
    let isLocal = false;

    if (profileSettings !== undefined && 'file' in profileSettings) {
      relativePath = profileSettings.file;
      actualPath = superJson.resolvePath(relativePath);
      isLocal = true;

      if (pathCommonParentLevel(actualPath) > 1) {
        options?.warnCb?.(
          `⚠️  Invalid path: "${relativePath}" (Installation path must point to inside "superface" or its parent directory)`
        );
        continue;
      }
    }

    // check existence and warn
    if (options?.force !== true && (await exists(actualPath))) {
      options?.warnCb?.(
        `⚠️  File already exists: "${actualPath}" (Use flag \`--force/-f\` for overwriting profiles)`
      );
      continue;
    }

    // save profile to resolved path
    await OutputStream.writeOnce(actualPath, response.profile, { dirs: true });
    options?.logCb?.(formatShellLog("echo '<profile>' >", [actualPath]));

    // save profile AST next to source
    const actualAstPath = `${actualPath}.ast.json`;
    await OutputStream.writeOnce(
      actualAstPath,
      JSON.stringify(response.ast, undefined, 2)
    );
    options?.logCb?.(formatShellLog("echo '<profileAST>' >", [actualAstPath]));

    // update super.json
    if (!isLocal) {
      superJson.addProfile(response.info.profile_name, {
        version: response.info.profile_version,
        providers: profileProviders,
      });
    } else {
      superJson.addProfile(response.info.profile_name, {
        file: relativePath,
        providers: profileProviders,
      });
    }

    installed += 1;
  }

  return installed;
}

/**
 * Extracts profile ids from `super.json`.
 */
export async function getProfileIds(
  superJson: SuperJson,
  options?: {
    warnCb?: LogCallback;
  }
): Promise<string[]> {
  return Promise.all(
    Object.entries(superJson.normalized.profiles).map(
      async ([profileId, profileSettings]) => {
        const id = profileId;

        if ('version' in profileSettings) {
          return `${id}@${profileSettings.version}`;
        }

        if ('file' in profileSettings) {
          try {
            const { header } = await getProfileDocument(
              superJson.resolvePath(profileSettings.file)
            );

            return `${id}@${composeVersion(header.version)}`;
          } catch (err) {
            options?.warnCb?.(
              `${id} - No version was found, returning default version 1.0.0`
            );
          }
        }

        // default
        return `${id}@1.0.0`;
      }
    )
  );
}

/**
 * If some profile id is specified, it'll request given profile from registry,
 * download it to /superface/grid folder, update super.json accordingly.
 *
 * If profile id is not specified, it'll look inside super.json and request all
 * profiles from registry and update super.json for each profile accordingly.
 *
 * @param superPath - path to directory where super.json located
 * @param profileId - profile specified as argument
 */
export async function installProfiles(
  superPath: string,
  profileId?: string,
  providers?: string[],
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
    force: boolean;
  }
): Promise<void> {
  const responses: ProfileResponse[] = [];

  const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
  const superJson = loadedResult.match(
    v => v,
    err => {
      options?.warnCb?.(err);

      return new SuperJson({});
    }
  );

  if (profileId) {
    responses.push(
      await getProfileFromStore(profileId, {
        logCb: options?.logCb,
      })
    );
  } else {
    const profileIds = await getProfileIds(superJson, options);

    const response = await Promise.all(
      profileIds.map(profileId =>
        getProfileFromStore(profileId, { logCb: options?.logCb })
      )
    );
    responses.push(...response);
  }
  let numOfInstalled = 0;
  if (responses.length > 0) {
    numOfInstalled = await handleProfileResponses(
      superJson,
      responses,
      providers ? constructProfileProviderSettings(providers) : undefined,
      options
    );

    // write new information to super.json
    await OutputStream.writeOnce(superJson.path, superJson.stringified);
    options?.logCb?.(
      formatShellLog("echo '<updated super.json>' >", [superJson.path])
    );

    if (numOfInstalled === 0) {
      options?.logCb?.(`❌ No profiles have been installed`);
    } else if (numOfInstalled < responses.length) {
      options?.logCb?.(
        `⚠️ Some profiles have been installed. Installed ${numOfInstalled} out of ${responses.length}`
      );
    } else {
      options?.logCb?.(`🆗 All profiles have been installed successfully.`);
    }
  } else {
    options?.logCb?.(`No profiles found to install`);
  }
}
