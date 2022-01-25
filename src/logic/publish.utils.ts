import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  MapDocumentNode,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import { Parser, SuperJson } from '@superfaceai/one-sdk';
import {
  composeVersion,
  getProfileOutput,
  validateMap,
} from '@superfaceai/parser';

import { UserError } from '../common/error';
import {
  fetchMapAST,
  fetchProfileAST,
  fetchProviderInfo,
} from '../common/http';
import { ILogger } from '../common/log';
import { ProfileId } from '../common/profile';
import { ProfileMapReport } from '../common/report.interfaces';
import {
  checkIntegrationParameters,
  checkMapAndProfile,
  checkMapAndProvider,
  CheckResult,
} from './check';
import {
  findLocalMapSource,
  findLocalProfileSource,
  findLocalProviderSource,
} from './check.utils';
import { createProfileMapReport } from './lint';

export function prePublishCheck(
  params: {
    publishing: 'map' | 'profile' | 'provider';
    profileAst: ProfileDocumentNode;
    mapAst: MapDocumentNode;
    providerJson: ProviderJson;
    profileFrom: ProfileFromMetadata;
    mapFrom: MapFromMetadata;
    providerFrom: ProviderFromMetadata;
    superJson: SuperJson;
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
): CheckResult[] {
  try {
    logger.info('assertProfile');
    assertProfileDocumentNode(params.profileAst);
  } catch (error) {
    throw userError(error, 1);
  }
  try {
    logger.info('assertMap');
    assertMapDocumentNode(params.mapAst);
  } catch (error) {
    throw userError(error, 1);
  }

  //Check map and profile
  const result: CheckResult[] = [];
  result.push({
    ...checkMapAndProfile(params.profileAst, params.mapAst, {
      //strict when we are publishing profile or map
      strict: params.publishing !== 'provider',
      logger,
    }),
    profileFrom: params.profileFrom,
    mapFrom: params.mapFrom,
  });

  //Check map and provider
  result.push({
    ...checkMapAndProvider(params.providerJson, params.mapAst),
    mapFrom: params.mapFrom,
    providerFrom: params.providerFrom,
  });

  //Check integration parameters
  result.push({
    ...checkIntegrationParameters(params.providerJson, params.superJson),
    providerFrom: params.providerFrom,
    superJsonPath: params.superJson.path,
  });

  return result;
}

export function prePublishLint(
  profileAst: ProfileDocumentNode,
  mapAst: MapDocumentNode
): ProfileMapReport {
  const profileOutput = getProfileOutput(profileAst);
  const result = validateMap(profileOutput, mapAst);

  //TODO: paths
  return createProfileMapReport(result, '', '');
}

/**
 * Represents information about source of the profile
 */
export type ProfileFromMetadata =
  | { kind: 'local'; source: string; path: string }
  | { kind: 'remote'; version: string };
/**
 * Loads profile source (if present on local filesystem) and AST (downloaded when source not found locally, compiled when found)
 */
export async function loadProfile(
  {
    superJson,
    profile,
    version,
  }: {
    superJson: SuperJson;
    profile: ProfileId;
    version?: string;
  },
  { logger }: { logger: ILogger }
): Promise<{
  ast: ProfileDocumentNode;
  from: ProfileFromMetadata;
}> {
  let ast: ProfileDocumentNode;

  const source = await findLocalProfileSource(superJson, profile, version);

  const profileId = `${profile.id}${version ? `@${version}` : ''}`;

  if (source) {
    ast = await Parser.parseProfile(source.source, profileId, {
      profileName: profile.name,
      scope: profile.scope,
    });
    logger.info('localProfileFound', profileId, source.path);

    return { ast, from: { kind: 'local', ...source } };
  } else {
    //Load from store
    ast = await fetchProfileAST(profile, version);
    const versionString = composeVersion(ast.header.version);
    logger.info('fetchProfile', profile.id, version);

    return {
      ast,
      from: { kind: 'remote', version: versionString },
    };
  }
}
/**
 * Represents information about source of the map
 */
export type MapFromMetadata =
  | { kind: 'local'; source: string; path: string }
  | { kind: 'remote'; variant?: string; version: string };

/**
 * Loads map source (if present on local filesystem) and AST (downloaded when source not found locally, compiled when found)
 */
export async function loadMap(
  {
    superJson,
    profile,
    provider,
    map,
    version,
  }: {
    superJson: SuperJson;
    profile: ProfileId;
    provider: string;
    map: {
      variant?: string;
    };
    version?: string;
  },
  { logger }: { logger: ILogger }
): Promise<{
  ast: MapDocumentNode;
  from: MapFromMetadata;
}> {
  const source = await findLocalMapSource(superJson, profile, provider);
  if (source) {
    const ast = await Parser.parseMap(
      source.source,
      `${profile.name}.${provider}`,
      {
        profileName: profile.name,
        scope: profile.scope,
        providerName: provider,
      }
    );
    logger.info(
      'localMapFound',
      profile.withVersion(version),
      provider,
      source.path
    );

    return {
      ast,
      from: {
        kind: 'local',
        ...source,
      },
    };
  } else {
    //Load from store
    const ast = await fetchMapAST({
      name: profile.name,
      provider,
      scope: profile.scope,
      version,
      variant: map.variant,
    });
    const astVersion = composeVersion(ast.header.profile.version);
    logger.info('fetchMap', profile.withVersion(version), provider, astVersion);

    return {
      ast,
      from: {
        kind: 'remote',
        variant: ast.header.variant,
        version: astVersion,
      },
    };
  }
}
/**
 * Represents information about source of the provider
 */
export type ProviderFromMetadata =
  | { kind: 'remote' }
  | { kind: 'local'; path: string };
/**
 * Loads provider source downloaded when source not found locally, loaded from file when found
 */
export async function loadProvider(
  superJson: SuperJson,
  provider: string,
  { logger }: { logger: ILogger }
): Promise<{
  source: ProviderJson;
  from: ProviderFromMetadata;
}> {
  const providerSource = await findLocalProviderSource(superJson, provider);
  if (providerSource) {
    logger.info('localProviderFound', provider, providerSource.path);

    return {
      source: providerSource.source,
      from: { kind: 'local', path: providerSource.path },
    };
  }
  logger.info('fetchProvider', provider);

  return {
    source: await fetchProviderInfo(provider),
    from: { kind: 'remote' },
  };
}
