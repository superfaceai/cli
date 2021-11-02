import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  assertProviderJson,
  isMapDefinitionNode,
  isUseCaseDefinitionNode,
  MapDocumentNode,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { green, red, yellow } from 'chalk';

import { composeVersion } from '..';
import { LogCallback } from '../common/log';
import { isProviderParseError } from './check.utils';
import { ProfileToValidate } from './lint';
import {
  loadMap,
  loadProfile,
  loadProvider,
  MapFromMetadata,
  ProfileFromMetadata,
  ProviderFromMetadata,
} from './publish.utils';

/**
 * Represents result of map & profile check
 */
type CheckMapProfileResult = {
  kind: 'profileMap';
  profileId: string;
  provider: string;
  issues: CheckIssue[];
};

/**
 * Represents result of mapt & provider check
 */
type CheckMapProviderResult = {
  kind: 'mapProvider';
  profileId: string;
  provider: string;
  issues: CheckIssue[];
};

/**
 * Represents result of integration parameters check
 */
type CheckIntegrationParametersResult = {
  kind: 'parameters';
  provider: string;
  issues: CheckIssue[];
};

/**
 * Represents result of capability check
 */
export type CheckResult =
  | (CheckMapProfileResult & {
      profileFrom: ProfileFromMetadata;
      mapFrom: MapFromMetadata;
    })
  | (CheckMapProviderResult & {
      mapFrom: MapFromMetadata;
      providerFrom: ProviderFromMetadata;
    })
  | (CheckIntegrationParametersResult & {
      providerFrom: ProviderFromMetadata;
      superJsonPath: string;
    });

export type CheckIssue = { kind: 'error' | 'warn'; message: string };

export async function check(
  superJson: SuperJson,
  profiles: ProfileToValidate[],
  options?: { logCb?: LogCallback; warnCb?: LogCallback }
): Promise<CheckResult[]> {
  const finalResults: CheckResult[] = [];

  for (const profile of profiles) {
    //Load profile AST
    const profileFiles = await loadProfile(
      superJson,
      profile.id,
      profile.version,
      options
    );
    assertProfileDocumentNode(profileFiles.ast);

    for (const map of profile.maps) {
      //Load map AST
      const mapFiles = await loadMap(
        superJson,
        profile.id,
        map.provider,
        { variant: map.variant },
        profile.version,
        options
      );
      assertMapDocumentNode(mapFiles.ast);

      //Load provider.json
      const providerFiles = await loadProvider(
        superJson,
        map.provider,
        options
      );

      options?.logCb?.(
        `Checking profile: "${profile.id.toString()}" and map for provider: "${
          map.provider
        }"`
      );
      //Check map and profile
      finalResults.push({
        ...checkMapAndProfile(profileFiles.ast, mapFiles.ast, options),
        mapFrom: mapFiles.from,
        profileFrom: profileFiles.from,
      });

      //Check map and provider
      options?.logCb?.(`Checking provider: "${map.provider}"`);
      finalResults.push({
        ...checkMapAndProvider(providerFiles.source, mapFiles.ast),
        mapFrom: mapFiles.from,
        providerFrom: providerFiles.from,
      });

      //Check integration parameters
      options?.logCb?.(
        `Checking integration parameters of provider: "${map.provider}"`
      );
      finalResults.push({
        ...checkIntegrationParameters(providerFiles.source, superJson),
        providerFrom: providerFiles.from,
        superJsonPath: superJson.path,
      });
    }
  }

  return finalResults;
}

export function checkIntegrationParameters(
  provider: ProviderJson,
  superJson: SuperJson
): CheckIntegrationParametersResult {
  const providerParameters = provider.parameters ?? [];
  const superJsonProvider = superJson.normalized.providers[provider.name];
  //If there is no provider with passed name there is high probability of not matching provider name in super.json and provider.json
  if (!superJsonProvider) {
    return {
      kind: 'parameters',
      issues: [
        {
          kind: 'error',
          message: `Provider ${provider.name} is not defined in super.json`,
        },
      ],
      provider: provider.name,
    };
  }
  const superJsonParameterKeys = Object.keys(superJsonProvider.parameters);
  const issues: CheckIssue[] = [];
  //Check if we have some extra parameters in super.json
  for (const key of superJsonParameterKeys) {
    const parameterFromProvider = providerParameters.find(
      parameter => parameter.name === key
    );
    if (!parameterFromProvider) {
      issues.push({
        kind: 'warn',
        message: `Super.json defines parameter: ${key} which is not needed in provider ${provider.name}`,
      });
    }
  }
  //Check if all of the provider parameters are defined
  for (const parameter of providerParameters) {
    if (!superJsonParameterKeys.includes(parameter.name)) {
      issues.push({
        kind: 'error',
        message: `Parameter ${parameter.name} is not defined in super.json for provider ${provider.name}`,
      });
    }
  }

  return {
    kind: 'parameters',
    issues,
    provider: provider.name,
  };
}

export function checkMapAndProvider(
  provider: ProviderJson,
  map: MapDocumentNode
): CheckMapProviderResult {
  const results: CheckIssue[] = [];
  try {
    assertProviderJson(provider);
  } catch (error) {
    if (isProviderParseError(error)) {
      results.push({
        kind: 'error',
        message: `Provider check error: ${
          error.message
        } on path ${error.path.join(', ')}`,
      });
    } else {
      throw error;
    }
  }

  //Check provider name
  if (map.header.provider !== provider.name) {
    results.push({
      kind: 'error',
      message: `Map contains provider with name: "${map.header.provider}" but provider.json contains provider with name: "${provider.name}"`,
    });
  }

  const profileId = `${
    map.header.profile.scope ? `${map.header.profile.scope}/` : ''
  }${map.header.profile.name}`;

  return {
    kind: 'mapProvider',
    provider: provider.name,
    profileId,
    issues: results,
  };
}

export function checkMapAndProfile(
  profile: ProfileDocumentNode,
  map: MapDocumentNode,
  options?: {
    strict?: boolean;
    logCb?: LogCallback;
  }
): CheckMapProfileResult {
  const results: CheckIssue[] = [];
  options?.logCb?.(
    `Checking versions of profile: "${profile.header.name}" and map for provider: "${map.header.provider}"`
  );
  //Header
  if (profile.header.scope !== map.header.profile.scope) {
    results.push({
      kind: 'error',
      message: `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different scope`,
    });
  }
  if (profile.header.name !== map.header.profile.name) {
    results.push({
      kind: 'error',
      message: `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different name`,
    });
  }
  if (profile.header.version.major !== map.header.profile.version.major) {
    results.push({
      kind: 'error',
      message: `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different MAJOR version`,
    });
  }
  if (profile.header.version.minor !== map.header.profile.version.minor) {
    results.push({
      kind: 'error',
      message: `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different MINOR version`,
    });
  }
  //Map and profile can differ in patch.
  if (profile.header.version.label !== map.header.profile.version.label) {
    results.push({
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
    results.push({
      kind: options?.strict ? 'error' : 'warn',
      message: `Profile "${profile.header.name}" defines ${profileUsecases.length} use cases but map for provider "${map.header.provider}" has ${mapUsecases.length}`,
    });
  }

  for (const usecase of profileUsecases) {
    if (!mapUsecases.includes(usecase)) {
      results.push({
        kind: options?.strict ? 'error' : 'warn',
        message: `Profile "${profile.header.name}" defines usecase ${usecase} but map for provider "${map.header.provider}" does not`,
      });
    }
  }

  const profileId = `${profile.header.scope ? `${profile.header.scope}/` : ''}${
    profile.header.name
  }@${composeVersion(profile.header.version)}`;

  return {
    kind: 'profileMap',
    issues: results,
    profileId,
    provider: map.header.provider,
  };
}

export function formatHuman(checkResults: CheckResult[]): string {
  const REPORT_OK = '🆗';
  const REPORT_WARN = '⚠️';
  const REPORT_ERR = '❌';

  const formatCheckIssue = (issue: CheckIssue): string => {
    if (issue.kind === 'error') {
      return red(`${REPORT_ERR} ${issue.message}\n`);
    } else {
      return yellow(`${REPORT_WARN} ${issue.message}\n`);
    }
  };

  const formatCheckResultTitle = (result: CheckResult): string => {
    let message = '';
    //Map&Profile
    if (result.kind === 'profileMap') {
      //Profile
      if (result.profileFrom.kind === 'local') {
        message += `Checking local profile ${result.profileId} at path\n${result.profileFrom.path}\n`;
      } else {
        message += `Checking remote profile ${result.profileId} with version ${result.profileFrom.version} `;
      }
      //Map
      if (result.mapFrom.kind === 'local') {
        message += `and local map for provider ${result.provider} at path\n${result.mapFrom.path}`;
      } else {
        message += `and remote map with version ${result.mapFrom.version} for provider ${result.provider}`;
      }
      //Map&Provider
    } else if (result.kind === 'mapProvider') {
      //Map
      if (result.mapFrom.kind === 'local') {
        message += `Checking local map at path\n${result.mapFrom.path}\nfor profile ${result.profileId} `;
      } else {
        message += `Checking remote map with version ${result.mapFrom.version} for profile ${result.profileId} `;
      }
      //Provider
      if (result.providerFrom.kind === 'local') {
        message += `and local provider ${result.provider} at path\n${result.providerFrom.path}`;
      } else {
        message += `and remote provider ${result.provider}`;
      }
      //Parameters
    } else {
      if (result.providerFrom.kind === 'local') {
        message += `Checking integration parameters of local provider at path\n${result.providerFrom.path}`;
      } else {
        message += `Checking integration parameters of remote provider ${result.provider} `;
      }
      message += `and super.json at path\n${result.superJsonPath}`;
    }
    if (result.issues.length === 0) {
      return green(`${REPORT_OK} ${message}\n`);
    } else if (result.issues.every(issue => issue.kind === 'warn')) {
      return yellow(`${REPORT_WARN} ${message}\n`);
    } else {
      return red(`${REPORT_ERR} ${message}\n`);
    }
  };

  let buffer = '';
  for (const result of checkResults) {
    buffer += formatCheckResultTitle(result);
    for (const issue of result.issues) {
      buffer += formatCheckIssue(issue);
    }
    buffer += '\n';
  }

  return buffer;
}

export function formatJson(checkResults: CheckResult[]): string {
  return JSON.stringify(checkResults);
}
