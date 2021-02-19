import { ProfileDocumentNode } from '@superfaceai/ast';
import {
  ProfileEntry,
  ProfileProviderSettings,
  SuperJson,
  SuperJsonDocument,
} from '@superfaceai/sdk';
import { isAbsolute, join as joinPath, normalize, relative } from 'path';

import {
  composeVersion,
  EXTENSIONS,
  getProfileDocument,
  META_FILE,
  SUPER_PATH,
  SUPERFACE_DIR,
  writeProfile,
  writeSuperJson,
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
    return normalize(relative(process.cwd(), cwd));
  }

  // check whether super.json is accessible in cwd/superface
  if (await isAccessible(joinPath(cwd, SUPER_PATH))) {
    return normalize(relative(process.cwd(), joinPath(cwd, SUPERFACE_DIR)));
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

interface ProfileResponse {
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

function validateProfilePath(file: string): boolean {
  if (isAbsolute(file)) {
    return false;
  }

  if (normalize(file).startsWith('../')) {
    return false;
  }

  return true;
}

/**
 * Handle responses from superface registry.
 * It saves profiles and its AST to grid folder and
 * it saves new information about profiles into super.json.
 */
export async function handleProfiles(
  superPath: string,
  responses: ProfileResponse[],
  { profiles, providers }: SuperJsonDocument,
  givenProviders?: string[],
  options?: { logCb?: LogCallback; warnCb?: LogCallback; force: boolean }
): Promise<number> {
  options?.logCb?.('Installing profiles');
  const writingOptions = { force: true, dirs: true };
  let installed = 0

  for (const {
    info: { profile_name },
    ast,
    profile,
  } of responses) {
    options?.logCb?.(`${installed+1}/${responses.length} installing ${profile_name}`)

    const targetProfile = profiles?.[profile_name];
    const targetProfilePath = joinPath(
      'grid',
      `${profile_name}${EXTENSIONS.profile.source}`
    );

    if (
      (await exists(joinPath(superPath, targetProfilePath))) &&
      !options?.force
    ) {
      options?.warnCb?.(
        `⚠️  File already exists: ${targetProfilePath} (Use flag \`--force/-f\` for overwriting profiles)`
      );
      continue;
    }

    let targetProfileProviders:
      | Record<string, ProfileProviderSettings | string>
      | undefined;

    if (targetProfile && typeof targetProfile !== 'string') {
      // check the file path if it's specified in super.json
      if ('file' in targetProfile) {
        if (!validateProfilePath(targetProfile.file)) {
          options?.warnCb?.(
            `⚠️  Invalid path: ${targetProfile.file} (File path in 'super.json' can't be outside '/superface' folder)`
          );
          continue;
        }
      }

      targetProfileProviders = targetProfile.providers;
    }

    // save profile name to old path or to /superface/grid
    const profileDownloaded = await writeProfile(
      joinPath(superPath, targetProfilePath),
      profile.toString(),
      writingOptions
    );

    if (profileDownloaded) {
      options?.logCb?.(
        formatShellLog("install '<profile>'", [
          joinPath(superPath, targetProfilePath),
        ])
      );
    }

    // save profile AST to /superface/build
    const profileAstPath = `${targetProfilePath}.ast.json`;
    const profileAstDownloaded = await writeProfile(
      joinPath(superPath, profileAstPath),
      JSON.stringify(ast, null, 2),
      writingOptions
    );

    if (profileAstDownloaded) {
      options?.logCb?.(
        formatShellLog('install <profileAST>', [
          joinPath(superPath, profileAstPath),
        ])
      );
    }

    if (givenProviders) {
      for (const provider of givenProviders) {
        if (!targetProfileProviders?.[provider]) {
          targetProfileProviders = {
            ...targetProfileProviders,
            [provider]: {
              mapVariant: 'default',
              mapRevision: '1',
            },
          };
        }
      }
    }

    if (!profiles) {
      profiles = {};
    }

    profiles[profile_name] = {
      file: targetProfilePath,
      providers: targetProfileProviders,
    };

    // write new information to super.json
    const superJsonUpdated = await writeSuperJson(
      joinPath(superPath, META_FILE),
      {
        profiles,
        providers,
      },
      writingOptions
    );

    if (superJsonUpdated) {
      options?.logCb?.(
        formatShellLog('update <super.json>', [joinPath(superPath, META_FILE)])
      );
    }

    installed++;
  }

  return installed
}

/**
 * Extracts profile ids from `super.json`.
 */
export async function getProfileIds(
  superPath: string,
  profiles: Record<string, ProfileEntry>
): Promise<string[]> {
  return Promise.all(
    Object.entries(profiles).map(async ([profileName, value]) => {
      const id = profileName;

      if (typeof value === 'string') {
        // if profile has only version assigned
        return `${id}@${value}`;
      } else {
        // if profile version field is specified
        if ('version' in value) {
          return `${id}@${value.version}`;
        }

        // if profile file field is specified
        if (value.file) {
          try {
            const { header } = await getProfileDocument(
              joinPath(superPath, value.file)
            );

            return `${id}@${composeVersion(header.version)}`;
          } catch (err) {
            throw userError(err, 1);
          }
        }

        // default
        return `${id}@1.0.0`;
      }
    })
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
  const superJson = new SuperJson(
    (await SuperJson.loadSuperJson()).match(
      v => v,
      err => {
        options?.warnCb?.(err);

        return {};
      }
    )
  ).normalized;

  if (profileId) {
    responses.push(
      await getProfileFromStore(profileId, {
        logCb: options?.logCb,
      })
    );
  } else {
    const profiles = await getProfileIds(superPath, superJson.profiles);

    for (const profileId of profiles) {
      responses.push(
        await getProfileFromStore(profileId, {
          logCb: options?.logCb,
        })
      );
    }
  }

  const numOfInstalled = await handleProfiles(superPath, responses, superJson, providers, options);


  if (numOfInstalled === 0) {
    options?.logCb?.(`❌ No profiles have been installed`)
  } else if (numOfInstalled < responses.length) {
    options?.logCb?.(`⚠️ Some profiles have been installed. Installed ${numOfInstalled} out of ${responses.length}`)
  } else {
    options?.logCb?.(`🆗 All profiles have been installed successfully.`)
  }
   
  options?.logCb?.('How to use Documentation will be HERE')
}
