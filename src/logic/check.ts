import {
  isMapDefinitionNode,
  isMapDocumentNode,
  isProfileDocumentNode,
  isUseCaseDefinitionNode,
  MapDocumentNode,
  ProfileASTNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { parseProviderJson, SuperJson } from '@superfaceai/one-sdk';

import { userError } from '../common/error';
import { exists, readFile } from '../common/io';
import { LogCallback } from '../common/log';

//TODO: loading should be done from .cache - path should be resolved from profileId
async function loadProfileAst(path: string): Promise<ProfileDocumentNode> {
  if (!(await exists(path))) {
    throw userError(`File: "${path}" not found - forgot to compile?`, 1);
  }
  const astFile = await readFile(path);
  const ast = Buffer.isBuffer(astFile) ? astFile.toString('utf8') : astFile;
  let astJson: ProfileASTNode;
  try {
    astJson = JSON.parse(ast) as ProfileDocumentNode;
  } catch (error) {
    throw userError(error, 1);
  }
  if (!isProfileDocumentNode(astJson)) {
    throw userError(`File "${path}" has unknown structure`, 1);
  }

  return astJson;
}
//TODO: loading should be done from .cache - path should be resolved from map
async function loadMapAst(path: string): Promise<MapDocumentNode> {
  if (!(await exists(path))) {
    throw userError(`File: "${path}" not found - forgot to compile?`, 1);
  }
  const astFile = await readFile(path);
  const ast = Buffer.isBuffer(astFile) ? astFile.toString('utf8') : astFile;
  let astJson: MapDocumentNode;
  try {
    astJson = JSON.parse(ast) as MapDocumentNode;
  } catch (error) {
    throw userError(error, 1);
  }
  if (!isMapDocumentNode(astJson)) {
    throw userError(`File "${path}" has unknown structure`, 1);
  }

  return astJson;
}
//TODO: return array of warnings/errors
function checkMapAndProfile(
  profile: ProfileDocumentNode,
  map: MapDocumentNode,
  options?: {
    logCb?: LogCallback;
  }
): void {
  options?.logCb?.(
    `Checking versions of profile: "${profile.header.name}" and map for provider: ""${map.header.provider}`
  );
  //Header
  if (profile.header.scope !== map.header.profile.scope) {
    throw userError(
      `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different scope`,
      1
    );
  }
  if (profile.header.name !== map.header.profile.name) {
    throw userError(
      `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different name`,
      1
    );
  }
  if (profile.header.version.major !== map.header.profile.version.major) {
    throw userError(
      `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different MAJOR version`,
      1
    );
  }
  if (profile.header.version.minor !== map.header.profile.version.minor) {
    throw userError(
      `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different MINOR version`,
      1
    );
  }
  //Map and profile can differ in patch.

  if (profile.header.version.label !== map.header.profile.version.label) {
    throw userError(
      `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different LABEL version`,
      1
    );
  }
  options?.logCb?.(
    `Checking usecase definitions in profile: "${profile.header.name}" and map for provider: "${map.header.provider}"`
  );

  //Definitions
  const mapUsecases: string[] = [];
  const profileUsecases: string[] = [];
  map.definitions.forEach(definition => {
    if (isMapDefinitionNode(definition))
      mapUsecases.push(definition.usecaseName);
  });
  profile.definitions.forEach(definition => {
    if (isUseCaseDefinitionNode(definition))
      profileUsecases.push(definition.useCaseName);
  });

  if (mapUsecases.length !== profileUsecases.length) {
    throw userError(
      `Profile "${profile.header.name}" defines ${profileUsecases.length} use cases but map for provider "${map.header.provider}" has ${mapUsecases.length}`,
      1
    );
  }

  for (const usecase of profileUsecases) {
    if (!mapUsecases.includes(usecase)) {
      throw userError(
        `Profile "${profile.header.name}" defines usecase ${usecase} but map for provider "${map.header.provider}" does not`,
        1
      );
    }
  }
}

export async function check(
  superJson: SuperJson,
  options?: { logCb?: LogCallback }
): Promise<void> {
  // const scopes = await getDirectories(`./${PROFILE_BUILD_PATH}`);
  let profileAst: ProfileDocumentNode;
  let mapAst: MapDocumentNode;

  for (const [profileName, profileSettings] of Object.entries(
    superJson.normalized.profiles
  )) {
    if ('file' in profileSettings) {
      //Load profile
      options?.logCb?.(
        `Checking profile: "${profileName}" on path "./${profileSettings.file}"`
      );
      profileAst = await loadProfileAst(
        superJson.resolvePath(profileSettings.file)
      );

      for (const [
        profileProviderName,
        profileProviderSettings,
      ] of Object.entries(superJson.normalized.profiles[profileName].providers))
        //TODO: actual value should not matter - ast should 
        if ('file' in profileProviderSettings) {
          //Load map
          mapAst = await loadMapAst(profileProviderSettings.file);

          //Check map and profile
          checkMapAndProfile(profileAst, mapAst);

          //Check provider
          const providerSettings =
            superJson.normalized.providers[profileProviderName];
          if (!providerSettings.file) {
            throw userError(
              `Map for profile: "${profileName}" na provider: "${profileProviderName}" implemented localy but provider.json not`,
              1
            );
          } else {
            if (!(await exists(providerSettings.file))) {
              throw userError(
                `Provider "${mapAst.header.provider}" not found`,
                1
              );
            }

            const providerFile = await readFile(providerSettings.file);
            const provider = Buffer.isBuffer(providerFile)
              ? providerFile.toString('utf8')
              : providerFile;

            options?.logCb?.(
              `Checking provider: "${profileProviderName}" on path: "${providerSettings.file}"`
            );
            try {
              parseProviderJson(JSON.parse(provider));
            } catch (error) {
              throw userError(error, 1);
            }
          }
        }
    }
  }
}
