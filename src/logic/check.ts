import type {
  MapDocumentNode,
  ProfileDocumentNode,
  ProviderJson,
  SuperJsonDocument,
} from '@superfaceai/ast';
import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  assertProviderJson,
  isMapDefinitionNode,
  isUseCaseDefinitionNode,
} from '@superfaceai/ast';
import { normalizeSuperJsonDocument } from '@superfaceai/one-sdk';
import { ProfileId } from '@superfaceai/parser';
import { green, red, yellow } from 'chalk';

import { composeVersion } from '../common/document';
import type { ILogger } from '../common/log';
import { isProviderParseError } from './check.utils';
import type { ProfileToValidate } from './lint';
import type {
  MapFromMetadata,
  ProfileFromMetadata,
  ProviderFromMetadata,
} from './publish/publish.utils';
import { loadMap, loadProfile, loadProvider } from './publish/publish.utils';

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
  superJson: SuperJsonDocument,
  superJsonPath: string,
  profiles: ProfileToValidate[],
  { logger }: { logger: ILogger }
): Promise<CheckResult[]> {
  const finalResults: CheckResult[] = [];

  for (const profile of profiles) {
    // Load profile AST
    const profileFiles = await loadProfile(
      {
        superJson,
        superJsonPath,
        profile: profile.id,
        version: profile.version,
      },
      { logger }
    );
    assertProfileDocumentNode(profileFiles.ast);

    for (const map of profile.maps) {
      const mapFiles = await loadMap(
        {
          superJson,
          superJsonPath,
          profile: profile.id,
          provider: map.provider,
          map: { variant: map.variant },
          version: profile.version,
        },
        { logger }
      );
      assertMapDocumentNode(mapFiles.ast);

      const providerFiles = await loadProvider(
        superJson,
        superJsonPath,
        map.provider,
        {
          logger,
        }
      );

      logger.info('checkProfileAndMap', profile.id.toString(), map.provider);
      finalResults.push({
        ...checkMapAndProfile(profileFiles.ast, mapFiles.ast, { logger }),
        mapFrom: mapFiles.from,
        profileFrom: profileFiles.from,
      });

      logger.info('checkProvider', map.provider);
      finalResults.push({
        ...checkMapAndProvider(providerFiles.source, mapFiles.ast),
        mapFrom: mapFiles.from,
        providerFrom: providerFiles.from,
      });

      logger.info('checkIntegrationParameters', map.provider);
      finalResults.push({
        ...checkIntegrationParameters(providerFiles.source, superJson),
        providerFrom: providerFiles.from,
        superJsonPath,
      });
    }
  }

  return finalResults;
}

export function checkIntegrationParameters(
  provider: ProviderJson,
  superJson: SuperJsonDocument
): CheckIntegrationParametersResult {
  const providerParameters = provider.parameters ?? [];
  const normalized = normalizeSuperJsonDocument(superJson);
  const superJsonProvider = normalized.providers[provider.name];
  // If there is no provider with passed name there is high probability of not matching provider name in super.json and provider.json
  if (superJsonProvider === undefined) {
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
  // Check if we have some extra parameters in super.json
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
  // Check if all of the provider parameters are defined
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
      error.errors.forEach(([message, path]) => {
        results.push({
          kind: 'error',
          message: `Provider check error: ${message} on path ${path.join(
            ', '
          )}`,
        });
      });
    } else {
      throw error;
    }
  }

  // Check provider name
  if (map.header.provider !== provider.name) {
    results.push({
      kind: 'error',
      message: `Map contains provider with name: "${map.header.provider}" but provider.json contains provider with name: "${provider.name}"`,
    });
  }

  const profileId = `${
    map.header.profile.scope !== undefined ? `${map.header.profile.scope}/` : ''
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
  options: {
    strict?: boolean;
    logger: ILogger;
  }
): CheckMapProfileResult {
  const results: CheckIssue[] = [];
  options.logger.info(
    'checkVersions',
    profile.header.name,
    map.header.provider
  );
  // Header
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
  // Map and profile can differ in patch.
  if (profile.header.version.label !== map.header.profile.version.label) {
    results.push({
      kind: 'error',
      message: `Profile "${profile.header.name}" has map for provider "${map.header.provider}" with different LABEL version`,
    });
  }
  options.logger.info(
    'checkUsecases',
    profile.header.name,
    map.header.provider
  );

  // Definitions
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
      kind: options?.strict === true ? 'error' : 'warn',
      message: `Profile "${profile.header.name}" defines ${profileUsecases.length} use cases but map for provider "${map.header.provider}" has ${mapUsecases.length}`,
    });
  }

  for (const usecase of profileUsecases) {
    if (!mapUsecases.includes(usecase)) {
      results.push({
        kind: options?.strict !== undefined ? 'error' : 'warn',
        message: `Profile "${profile.header.name}" defines usecase ${usecase} but map for provider "${map.header.provider}" does not`,
      });
    }
  }

  const profileId = `${
    profile.header.scope !== undefined ? `${profile.header.scope}/` : ''
  }${profile.header.name}@${composeVersion(profile.header.version)}`;

  return {
    kind: 'profileMap',
    issues: results,
    profileId,
    provider: map.header.provider,
  };
}

export function formatHuman({
  checkResults,
  emoji,
  color,
}: {
  checkResults: CheckResult[];
  emoji: boolean;
  color: boolean;
}): string {
  const REPORT_OK = '🆗 ';
  const REPORT_WARN = '⚠️ ';
  const REPORT_ERR = '❌ ';

  const formatCheckIssue = (issue: CheckIssue): string => {
    if (issue.kind === 'error') {
      const message = `${emoji ? REPORT_ERR : ''}${issue.message}\n`;

      return color ? red(message) : message;
    } else {
      const message = `${emoji ? REPORT_WARN : ''} ${issue.message}\n`;

      return color ? yellow(message) : message;
    }
  };

  const formatCheckResultTitle = (result: CheckResult): string => {
    let message = '';
    // Map&Profile
    if (result.kind === 'profileMap') {
      // Profile
      if (result.profileFrom.kind === 'local') {
        message += `Checking local profile "${result.profileId}" at path\n"${result.profileFrom.path}" `;
      } else {
        message += `Checking remote profile "${
          ProfileId.fromId(result.profileId).withoutVersion
        }" with version "${result.profileFrom.version}" `;
      }
      // Map
      if (result.mapFrom.kind === 'local') {
        message += `and local map for provider "${result.provider}" at path\n"${result.mapFrom.path}"`;
      } else {
        message += `and remote map with version "${result.mapFrom.version}" for provider "${result.provider}"`;
      }
      // Map&Provider
    } else if (result.kind === 'mapProvider') {
      // Map
      if (result.mapFrom.kind === 'local') {
        message += `Checking local map at path\n"${result.mapFrom.path}"\nfor profile "${result.profileId}" `;
      } else {
        message += `Checking remote map with version "${result.mapFrom.version}" for profile "${result.profileId}" `;
      }
      // Provider
      if (result.providerFrom.kind === 'local') {
        message += `and local provider "${result.provider}" at path\n"${result.providerFrom.path}" `;
      } else {
        message += `and remote provider "${result.provider}" `;
      }
      // Parameters
    } else {
      if (result.providerFrom.kind === 'local') {
        message += `Checking integration parameters of local provider at path\n"${result.providerFrom.path}" `;
      } else {
        message += `Checking integration parameters of remote provider "${result.provider}" `;
      }
      message += `and super.json at path\n"${result.superJsonPath}"`;
    }
    if (result.issues.length === 0) {
      message = `${emoji ? REPORT_OK : ''}${message}\n`;

      return color ? green(message) : message;
    } else if (result.issues.every(issue => issue.kind === 'warn')) {
      message = `${emoji ? REPORT_WARN : ''}${message}\n`;

      return color ? yellow(message) : message;
    } else {
      message = `${REPORT_ERR}${message}\n`;

      return color ? red(message) : message;
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
