import { parseProfileId } from '@superfaceai/parser';
import { isAbsolute, join as joinPath, normalize, relative } from 'path';

import {
  composeVersion,
  EXTENSIONS,
  getProfileDocument,
  META_FILE,
  parseSuperJson,
  writeProfile,
  writeSuperJson,
} from '../common/document';
import { userError } from '../common/error';
import { exists, isAccessible, readFile } from '../common/io';
import { formatShellLog, LogCallback } from '../common/log';
import {
  ProfileSettings,
  SuperJsonStructure,
} from '../common/super.interfaces';

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

interface RegistryResponseMock {
  response: {
    profileId: string;
    profileName: string;
    profileVersion: string;
    url: string;
  };
  ast: string;
  profile: string;
}

/**
 * Mock the Superface registry API GET call.
 * It should query the newest profile in valid scope (https://semver.org/)
 */
export async function getProfileFromRegistry(
  superPath: string,
  profileId: string
): Promise<RegistryResponseMock> {
  // const query = `/profiles/${profileId}`
  const REGISTRY_DIR = joinPath(superPath, '..', '..', 'registry');

  const parsedId = parseProfileId(profileId);
  if (parsedId.kind === 'error') {
    throw userError(parsedId.message, 31);
  }

  const { scope, name, version } = parsedId.value;
  const fileName = `${name}@${composeVersion(version)}`;
  const filePath = scope
    ? joinPath(REGISTRY_DIR, scope, fileName)
    : joinPath(REGISTRY_DIR, fileName);

  const profilePath = `${filePath}${EXTENSIONS.profile.source}`;
  const profileAstPath = `${filePath}${EXTENSIONS.profile.build}`;

  try {
    const profileDocument = await getProfileDocument(profilePath);
    const profileName = profileDocument.header.scope
      ? `${profileDocument.header.scope}/${profileDocument.header.name}`
      : profileDocument.header.name;

    const profile = await readFile(profilePath, { encoding: 'utf-8' });
    const ast = await readFile(profileAstPath, { encoding: 'utf-8' });

    return {
      response: {
        profileId,
        profileName,
        profileVersion: composeVersion(profileDocument.header.version),
        url: `https://some.url/profiles/${profileId}`,
      },
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
  responses: RegistryResponseMock[],
  { profiles, providers }: SuperJsonStructure,
  options: { logCb?: LogCallback; warnCb?: LogCallback; force: boolean }
): Promise<void> {
  const writingOptions = { force: true, dirs: true };
  const buildPath = joinPath(superPath, 'build');

  for (const {
    response: { profileName, profileVersion },
    ast,
    profile,
  } of responses) {
    const targetProfile = profiles[profileName];

    // store path if profile has one specified in super.json
    const profilePath = `${profileName}${EXTENSIONS.profile.source}`;
    let targetProfilePath = joinPath('grid', profilePath);

    if (
      targetProfile &&
      typeof targetProfile !== 'string' &&
      targetProfile.file
    ) {
      const path = targetProfile.file.slice('file:'.length);

      if (!validateProfilePath(path)) {
        options.warnCb?.(
          `⚠️  Invalid path: ${targetProfile.file} (File path in 'super.json' can't be outside '/superface' folder)`
        );
        continue;
      }

      if ((await exists(joinPath(superPath, path))) && !options.force) {
        options.warnCb?.(
          `⚠️  File already exists: ${path} (Use flag \`--force/-f\` for overwriting profiles)`
        );
        continue;
      }

      targetProfilePath = path;
    }

    // save profile name to old path or to /superface/grid
    const profileDownloaded = await writeProfile(
      joinPath(superPath, targetProfilePath),
      profile,
      writingOptions
    );

    if (profileDownloaded) {
      options.logCb?.(
        formatShellLog("download '<profile>'", [
          joinPath(superPath, targetProfilePath),
        ])
      );
    }

    // save profile AST to /superface/build
    const profileAstPath = `${profileName}${EXTENSIONS.profile.build}`;
    const profileAstDownloaded = await writeProfile(
      joinPath(buildPath, profileAstPath),
      ast,
      writingOptions
    );

    if (profileAstDownloaded) {
      options.logCb?.(
        formatShellLog('download <profileAST>', [
          joinPath(buildPath, profileAstPath),
        ])
      );
    }

    // write new information to super.json
    profiles[profileName] = {
      file: `file:${targetProfilePath}`,
      version: profileVersion,
    };

    const superJsonUpdated = await writeSuperJson(
      joinPath(superPath, META_FILE),
      {
        profiles,
        providers,
      },
      writingOptions
    );

    if (superJsonUpdated) {
      options.logCb?.(
        formatShellLog('update <super.json>', [joinPath(superPath, META_FILE)])
      );
    }
  }
}

/**
 * Extracts profile ids from `super.json`.
 */
export async function getProfileIds(
  profiles: ProfileSettings
): Promise<string[]> {
  return Object.entries(profiles).map(([profileName, value]) => {
    let id = profileName;

    if (typeof value === 'string') {
      // if profile has only version assigned
      id += `@${value}`;
    } else {
      // TODO: get version out of profile if version is not specified
      id += `@${value.version ?? '1.0.0'}`;
    }

    return id;
  });
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
  options: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
    force: boolean;
  },
  profileId?: string
): Promise<void> {
  const superJson = await parseSuperJson(joinPath(superPath, META_FILE));
  const responses: RegistryResponseMock[] = [];

  if (profileId) {
    responses.push(await getProfileFromRegistry(superPath, profileId));
  } else {
    const profiles = await getProfileIds(superJson.profiles);

    for (const profileId of profiles) {
      responses.push(await getProfileFromRegistry(superPath, profileId));
    }
  }

  await handleProfiles(superPath, responses, superJson, options);
}
