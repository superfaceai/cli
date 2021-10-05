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
  Parser,
  ProviderJson,
  SuperJson,
} from '@superfaceai/one-sdk';
import { MapId, ProfileId } from '@superfaceai/parser';
import { green, red, yellow } from 'chalk';

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
  isProviderParseError,
} from './check.utils';

export type CheckResult = { kind: 'error' | 'warn'; message: string };

export async function check(
  superJson: SuperJson,
  profile: ProfileId,
  map: MapId,
  options?: { logCb?: LogCallback; warnCb?: LogCallback }
): Promise<CheckResult[]> {
  let profileAst: ProfileDocumentNode;
  let mapAst: MapDocumentNode;
  let providerJson: ProviderJson;
  let numberOfRemoteFilesUsed = 0;

  //Load profile AST
  const profileSource = await findLocalProfileSource(superJson, profile);
  if (profileSource) {
    //Enforce parsing
    profileAst = await Parser.parseProfile(profileSource, profile.toString(), {
      profileName: profile.name,
      scope: profile.scope,
    });
    options?.logCb?.(
      `Profile: "${profile.withoutVersion}" found on local file system`
    );
  } else {
    //Load from store
    options?.logCb?.(
      `Loading profile: "${profile.toString()}" from Superface store`
    );
    profileAst = await fetchProfileAST(profile);
    numberOfRemoteFilesUsed++;
  }
  if (!isProfileDocumentNode(profileAst)) {
    throw userError(`Profile file has unknown structure`, 1);
  }

  //Load map AST
  const mapSource = await findLocalMapSource(superJson, map);
  if (mapSource) {
    //Enforce parsing
    mapAst = await Parser.parseMap(
      mapSource,
      `${profile.name}.${map.provider}`,
      {
        profileName: profile.name,
        scope: profile.scope,
        providerName: map.provider,
      }
    );
    options?.logCb?.(
      `Map for profile: "${profile.withoutVersion}" and provider: "${map.provider}" found on local filesystem`
    );
  } else {
    //Load from store
    options?.logCb?.(
      `Loading map for profile: "${profile.toString()}" and provider: "${
        map.provider
      }" from Superface store`
    );
    mapAst = await fetchMapAST(map);
    numberOfRemoteFilesUsed++;
  }

  if (!isMapDocumentNode(mapAst)) {
    throw userError(`Map file has unknown structure`, 1);
  }

  //Load provider.json
  const localProviderJson = await findLocalProviderSource(
    superJson,
    map.provider
  );
  if (localProviderJson) {
    providerJson = localProviderJson;
    options?.logCb?.(`Provider: "${map.provider}" found on local file system`);
  } else {
    options?.logCb?.(
      `Loading provider: "${map.provider}" from Superface store`
    );
    providerJson = await fetchProviderInfo(map.provider);
    numberOfRemoteFilesUsed++;
  }

  if (numberOfRemoteFilesUsed === 3) {
    options?.warnCb?.(
      `All files for specified capability have been downloaded - checking only remote files is redundant`
    );
  }

  options?.logCb?.(
    `Checking profile: "${profile.name}" and map for provider: "${map.provider}"`
  );
  //Check map and profile
  const result = checkMapAndProfile(profileAst, mapAst, options);

  options?.logCb?.(`Checking provider: "${map.provider}"`);
  result.push(...checkMapAndProvider(providerJson, mapAst));

  return result;
}

export function checkMapAndProvider(
  provider: ProviderJson,
  map: MapDocumentNode
): CheckResult[] {
  const result: CheckResult[] = [];
  try {
    parseProviderJson(provider);
  } catch (error) {
    if (isProviderParseError(error)) {
      for (const issue of error.issues) {
        result.push({
          kind: 'error',
          message: `Provider check error: ${issue.code}: ${
            issue.message
          } on path ${issue.path
            .map(value => {
              return typeof value === 'string' ? value : value.toString();
            })
            .join(', ')}`,
        });
      }
    } else {
      throw error;
    }
  }

  //Check provider name
  if (map.header.provider !== provider.name) {
    result.push({
      kind: 'error',
      message: `Map contains provider with name: "${map.header.provider}" but provider.json contains provider with name: "${provider.name}"`,
    });
  }

  return result;
}

export function checkMapAndProfile(
  profile: ProfileDocumentNode,
  map: MapDocumentNode,
  options?: {
    strict?: boolean;
    logCb?: LogCallback;
  }
): CheckResult[] {
  const result: CheckResult[] = [];
  options?.logCb?.(
    `Checking versions of profile: "${profile.header.name}" and map for provider: "${map.header.provider}"`
  );
  //Header
  if (profile.header.scope !== map.header.profile.scope) {
    result.push({
      kind: 'error',
      message: `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different scope`,
    });
  }
  if (profile.header.name !== map.header.profile.name) {
    result.push({
      kind: 'error',
      message: `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different name`,
    });
  }
  if (profile.header.version.major !== map.header.profile.version.major) {
    result.push({
      kind: 'error',
      message: `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different MAJOR version`,
    });
  }
  if (profile.header.version.minor !== map.header.profile.version.minor) {
    result.push({
      kind: 'error',
      message: `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different MINOR version`,
    });
  }
  //Map and profile can differ in patch.
  if (profile.header.version.label !== map.header.profile.version.label) {
    result.push({
      kind: 'error',
      message: `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different LABEL version`,
    });
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
    result.push({
      kind: options?.strict ? 'error' : 'warn',
      message: `Profile "${profile.header.name}" defines ${profileUsecases.length} use cases but map for provider "${map.header.provider}" has ${mapUsecases.length}`,
    });
  }

  for (const usecase of profileUsecases) {
    if (!mapUsecases.includes(usecase)) {
      result.push({
        kind: options?.strict ? 'error' : 'warn',
        message: `Profile "${profile.header.name}" defines usecase ${usecase} but map for provider "${map.header.provider}" does not`,
      });
    }
  }

  return result;
}

export function formatHuman(checkResults: CheckResult[]): string {
  const REPORT_OK = '🆗';
  const REPORT_WARN = '⚠️';
  const REPORT_ERR = '❌';

  if (checkResults.length === 0) {
    return green(`${REPORT_OK} check without errors.\n`);
  }
  let buffer = '';
  for (const result of checkResults) {
    if (result.kind === 'error') {
      buffer += red(`${REPORT_ERR} ${result.message}\n`);
    } else if (result.kind === 'warn') {
      buffer += yellow(`${REPORT_WARN} ${result.message}\n`);
    }
  }

  return buffer;
}

export function formatJson(checkResults: CheckResult[]): string {
  return JSON.stringify(checkResults);
}
