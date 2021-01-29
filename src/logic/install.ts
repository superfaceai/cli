import { parseProfileId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import {
  AST_EXTENSIONS,
  composeVersion,
  getProfileDocument,
  PROFILE_EXTENSIONS,
  SUPER_JSON_EXTENSIONS,
} from '../common/document';
import { userError } from '../common/error';
import { isFileQuiet, OutputStream, readdir, readFile } from '../common/io';
import { SuperJsonStructure } from '../common/super.interfaces';

/**
 * Detects the existence of a `super.json` file at the application path.
 */
export async function detectSuperJson(appPath: string): Promise<boolean> {
  return (
    (await isFileQuiet(joinPath(appPath, SUPER_JSON_EXTENSIONS[0]))) ||
    (await isFileQuiet(
      joinPath(appPath, 'superface', SUPER_JSON_EXTENSIONS[0])
    ))
  );
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
 * Mock the Superface registry API GET call
 */
export async function getProfileFromRegistry(
  profileId: string
): Promise<RegistryResponseMock> {
  // const query = `/profiles/${profileId}`
  const parsedId = parseProfileId(profileId);

  if (parsedId.kind === 'error') {
    throw userError(parsedId.message, 31);
  }

  const filePath = parsedId.value.scope
    ? joinPath('../', 'registry', parsedId.value.scope, parsedId.value.name)
    : joinPath('../', 'registry', parsedId.value.name);

  const profilePath = `${filePath}${PROFILE_EXTENSIONS[0]}`;
  const profileAstPath = `${filePath}${PROFILE_EXTENSIONS[0]}${AST_EXTENSIONS[0]}`;

  const profileDocument = await getProfileDocument(profilePath);
  const profileName = profileDocument.header.scope
    ? `${profileDocument.header.scope}/${profileDocument.header.name}`
    : profileDocument.header.name;

  const profile = (await readFile(profilePath)).toString();
  const ast = (await readFile(profileAstPath)).toString();

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
}

/**
 * Handle responses from superface registry.
 * It saves profiles and its AST to grid folder and
 * it saves new information about profiles into super.json.
 *
 * @param path - represents path to /superface directory
 * @param responses - represents responses from registry (mock)
 */
export async function handleProfiles(
  path: string,
  ...responses: RegistryResponseMock[]
): Promise<void> {
  const gridPath = joinPath(path, 'grid');
  const superJsonPath = joinPath(path, 'super.json');
  const options = { force: true, dirs: true };
  const superJson = JSON.parse(
    await readFile(superJsonPath, { encoding: 'utf-8' })
  ) as SuperJsonStructure;

  for (const {
    response: { profileName, profileVersion },
    ast,
    profile,
  } of responses) {
    const profilePath = `${profileName}${PROFILE_EXTENSIONS[0]}`;
    const profileAstPath = `${profileName}${PROFILE_EXTENSIONS[0]}${AST_EXTENSIONS[0]}`;

    // 1. save profiles to /superface/grid
    await OutputStream.writeIfAbsent(
      joinPath(gridPath, profilePath),
      profile,
      options
    );
    await OutputStream.writeIfAbsent(
      joinPath(gridPath, profileAstPath),
      ast,
      options
    );

    // TODO: better handling of writing to super.json
    // 2. save new information about the profile to super.json
    superJson.profiles[profileName] = {
      file: `file:./${joinPath('grid', profilePath)}`,
      version: profileVersion,
    };
  }

  // 3. save super.json
  await OutputStream.writeOnce(
    superJsonPath,
    JSON.stringify(superJson, null, 2)
  );
}

function excludeProfileExtension(filePath: string): string {
  return filePath.slice(0, filePath.length - PROFILE_EXTENSIONS[0].length);
}

/**
 * Find and construct profile ids in directory given by @param path.
 *
 * If a file is found, check its extension and add it to array of results.
 *
 * If a directory is found, it'll treat it as a scope, it will look for
 * profiles inside and add them to array of results with corresponding scope.
 *
 */
export async function getProfileIds(path: string): Promise<string[]> {
  const dirents = await readdir(path, {
    withFileTypes: true,
  });

  const profiles: string[] = [];
  for (const dirent of dirents) {
    if (dirent.isFile() && dirent.name.endsWith(PROFILE_EXTENSIONS[0])) {
      const {
        header: { version },
      } = await getProfileDocument(joinPath(path, dirent.name));

      profiles.push(
        `${excludeProfileExtension(dirent.name)}@${composeVersion(version)}`
      );
    }

    if (dirent.isDirectory()) {
      const profilesInScope = (
        await getProfileIds(joinPath(path, dirent.name))
      ).map(profile => joinPath(dirent.name, profile));

      profiles.push(...profilesInScope);
    }
  }

  return profiles;
}

/**
 * If some profile id is specified, it'll request given profile from registry,
 * download it to /superface/grid folder, update super.json accordingly.
 *
 * If profile id is not specified, it'll look for profiles inside /superface/grid folder,
 * request new profiles from registry and update super.json for each profile accordingly.
 *
 * @param appPath - cwd of install command
 * @param profileId - profile specified as argument
 */
export async function installProfiles(
  appPath: string,
  profileId?: string
): Promise<void> {
  const responses: RegistryResponseMock[] = [];
  const superfacePath = joinPath(appPath, 'superface');

  if (profileId) {
    responses.push(await getProfileFromRegistry(profileId));
  } else {
    const gridPath = joinPath(superfacePath, 'grid');
    const profiles = await getProfileIds(gridPath);

    for (const profileId of profiles) {
      responses.push(await getProfileFromRegistry(profileId));
    }
  }

  await handleProfiles(superfacePath, ...responses);
}
