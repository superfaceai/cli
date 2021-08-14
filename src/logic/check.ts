import {
  isMapDefinitionNode,
  isMapDocumentNode,
  isProfileDocumentNode,
  isUseCaseDefinitionNode,
  MapDocumentNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import {
  parseProviderJson,
  ProviderJson,
  SuperJson,
} from '@superfaceai/one-sdk';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';

import { userError } from '../common/error';
import {
  fetchMapAST,
  fetchProfileAST,
  fetchProviderInfo,
} from '../common/http';
import { LogCallback } from '../common/log';
import {
  findLocalMapSource,
  findLocalProfileSource,
  findLocalProviderSource,
} from './check.utils';

export async function check(
  superJson: SuperJson,
  profile: {
    name: string;
    scope?: string;
    version?: string;
  },
  provider: string,
  map: {
    variant?: string;
  },
  options?: { logCb?: LogCallback; warnCB?: LogCallback }
): Promise<void> {
  let profileAst: ProfileDocumentNode;
  let mapAst: MapDocumentNode;
  let providerJson: ProviderJson;
  let numberOfRemoteFilesUsed = 0;

  //Load profile AST
  const profileId = `${profile.scope ? `${profile.scope}/` : ''}${
    profile.name
  }${profile.version ? `@${profile.version}` : ''}`;
  const profileSource = await findLocalProfileSource(
    superJson,
    profile,
    options
  );
  if (profileSource) {
    profileAst = parseProfile(new Source(profileSource, profileId));
  } else {
    //Load from store
    options?.logCb?.(`Loading profile: "${profileId}" from Superface store`);
    profileAst = await fetchProfileAST(profileId);
    numberOfRemoteFilesUsed++;
  }
  if (!isProfileDocumentNode(profileAst)) {
    throw userError(`Profile file has unknown structure`, 1);
  }

  //Load map AST
  const mapSource = await findLocalMapSource(
    superJson,
    profile,
    provider,
    options
  );
  if (mapSource) {
    mapAst = parseMap(new Source(mapSource, `${profile.name}.${provider}`));
  } else {
    //Load from store
    options?.logCb?.(
      `Loading map for profile: "${profileId}" and provider: "${provider}" from Superface store`
    );
    //TODO: use actual implementation
    mapAst = await fetchMapAST(
      profile.name,
      provider,
      profile.scope,
      profile.version,
      map.variant
    );
    numberOfRemoteFilesUsed++;
  }

  if (!isMapDocumentNode(mapAst)) {
    throw userError(`Map file has unknown structure`, 1);
  }

  //Load provider.json
  const localProviderJson = await findLocalProviderSource(
    superJson,
    provider,
    options
  );
  if (localProviderJson) {
    providerJson = localProviderJson;
  } else {
    options?.logCb?.(`Loading provider "${provider}" from Superface store`);
    providerJson = await fetchProviderInfo(provider);
    numberOfRemoteFilesUsed++;
  }

  if (numberOfRemoteFilesUsed === 3) {
    options?.warnCB?.(
      `All files for specified capability have been downloaded - checking only remote files is redundant`
    );
  }

  options?.logCb?.(
    `Checking profile: "${profile.name}" and map for provider: "${provider}"`
  );
  //Check map and profile
  checkMapAndProfile(profileAst, mapAst, options);

  try {
    parseProviderJson(providerJson);
  } catch (error) {
    throw userError(error, 1);
  }
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
    `Checking versions of profile: "${profile.header.name}" and map for provider: "${map.header.provider}"`
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

  options?.logCb?.(`Checking complete without errors`);
}
