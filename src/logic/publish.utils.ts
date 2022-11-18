import type {
  MapDocumentNode,
  ProfileDocumentNode,
  ProviderJson,
  SuperJsonDocument,
} from '@superfaceai/ast';
import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
} from '@superfaceai/ast';
import {
  composeVersion,
  getProfileOutput,
  parseMap,
  parseProfile,
  Source,
  validateMap,
} from '@superfaceai/parser';

import type { UserError } from '../common/error';
import {
  fetchMapAST,
  fetchProfileAST,
  fetchProviderInfo,
} from '../common/http';
import type { ILogger } from '../common/log';
import type { ProfileId } from '../common/profile';
import type { ProfileMapReport } from '../common/report.interfaces';
import type { CheckResult } from './check';
import {
  checkIntegrationParameters,
  checkMapAndProfile,
  checkMapAndProvider,
} from './check';
import {
  findLocalMapSource,
  findLocalProfileSource,
  findLocalProviderSource,
} from './check.utils';
import { createProfileMapReport } from './lint';

export function prePublishCheck(
  {
    publishing,
    profileAst,
    mapAst,
    providerJson,
    profileFrom,
    mapFrom,
    providerFrom,
    superJson,
    superJsonPath,
  }: {
    publishing: { map: boolean; profile: boolean; provider: boolean };
    profileAst: ProfileDocumentNode;
    mapAst: MapDocumentNode;
    providerJson: ProviderJson;
    profileFrom: ProfileFromMetadata;
    mapFrom: MapFromMetadata;
    providerFrom: ProviderFromMetadata;
    superJson: SuperJsonDocument;
    superJsonPath: string;
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
): CheckResult[] {
  try {
    logger.info('assertProfile');
    assertProfileDocumentNode(profileAst);
  } catch (error) {
    throw userError(
      `Profile AST validation failed ${(error as { message: string }).message}`,
      1
    );
  }
  try {
    logger.info('assertMap');
    assertMapDocumentNode(mapAst);
  } catch (error) {
    throw userError(
      `Map AST validation failed ${(error as { message: string }).message}`,
      1
    );
  }

  // Check map and profile
  const result: CheckResult[] = [];
  result.push({
    ...checkMapAndProfile(profileAst, mapAst, {
      // strict when we are publishing profile or map
      strict: publishing.profile && publishing.map,
      logger,
    }),
    profileFrom: profileFrom,
    mapFrom: mapFrom,
  });

  // Check map and provider
  result.push({
    ...checkMapAndProvider(providerJson, mapAst),
    mapFrom: mapFrom,
    providerFrom: providerFrom,
  });

  // Check integration parameters
  result.push({
    ...checkIntegrationParameters(providerJson, superJson),
    providerFrom: providerFrom,
    superJsonPath: superJsonPath,
  });

  return result;
}

export function prePublishLint(
  profileAst: ProfileDocumentNode,
  mapAst: MapDocumentNode
): ProfileMapReport {
  const profileOutput = getProfileOutput(profileAst);
  const result = validateMap(profileOutput, mapAst);

  // TODO: paths
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
    superJsonPath,
    profile,
    version,
  }: {
    superJson: SuperJsonDocument;
    superJsonPath: string;
    profile: ProfileId;
    version?: string;
  },
  { logger }: { logger: ILogger }
): Promise<{
  ast: ProfileDocumentNode;
  from: ProfileFromMetadata;
}> {
  let ast: ProfileDocumentNode;

  const source = await findLocalProfileSource(
    superJson,
    superJsonPath,
    profile,
    version
  );

  const profileId = `${profile.id}${
    version !== undefined ? `@${version}` : ''
  }`;

  if (source) {
    ast = parseProfile(new Source(source.source, profileId));
    logger.info('localProfileFound', profileId, source.path);

    return { ast, from: { kind: 'local', ...source } };
  } else {
    // Load from store
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
    superJsonPath,
    profile,
    provider,
    map,
    version,
  }: {
    superJson: SuperJsonDocument;
    superJsonPath: string;
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
  const source = await findLocalMapSource(
    superJson,
    superJsonPath,
    profile,
    provider
  );
  if (source) {
    const ast = parseMap(
      new Source(source.source, `${profile.name}.${provider}`)
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
    // Load from store
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
  superJson: SuperJsonDocument,
  superJsonPath: string,
  provider: string,
  { logger }: { logger: ILogger }
): Promise<{
  source: ProviderJson;
  from: ProviderFromMetadata;
}> {
  const providerSource = await findLocalProviderSource(
    superJson,
    superJsonPath,
    provider
  );
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
