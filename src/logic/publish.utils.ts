import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  MapDocumentNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { Parser, ProviderJson, SuperJson } from '@superfaceai/one-sdk';
import {
  composeVersion,
  getProfileOutput,
  MapId,
  ProfileId,
  validateMap,
} from '@superfaceai/parser';

import { userError } from '../common/error';
import {
  fetchMapAST,
  fetchProfileAST,
  fetchProviderInfo,
} from '../common/http';
import { LogCallback } from '../common/log';
import { ProfileMapReport } from '../common/report.interfaces';
import { checkMapAndProfile, checkMapAndProvider, CheckResult } from './check';
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
  },
  options?: { logCb?: LogCallback; warnCb?: LogCallback }
): CheckResult[] {
  try {
    options?.logCb?.('Asserting profile document');
    assertProfileDocumentNode(params.profileAst);
  } catch (error) {
    throw userError(error, 1);
  }
  try {
    options?.logCb?.('Asserting map document');
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
      logCb: options?.logCb,
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
  superJson: SuperJson,
  profile: ProfileId,
  options?: {
    logCb?: LogCallback;
  }
): Promise<{
  ast: ProfileDocumentNode;
  from: ProfileFromMetadata;
}> {
  let ast: ProfileDocumentNode;

  const source = await findLocalProfileSource(superJson, profile);

  if (source) {
    ast = await Parser.parseProfile(source.source, profile.toString(), {
      profileName: profile.name,
      scope: profile.scope,
    });
    options?.logCb?.(
      `Profile: "${profile.toString()}" found on local file system`
    );

    return { ast, from: { kind: 'local', ...source } };
  } else {
    //Load from store
    ast = await fetchProfileAST(profile);
    const version = composeVersion(ast.header.version);
    options?.logCb?.(
      `Loading profile: "${profile.withoutVersion}" in version: "${version}" from Superface store`
    );

    return {
      ast,
      from: { kind: 'remote', version },
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
  map: MapId,
  superJson: SuperJson,
  options?: {
    logCb?: LogCallback;
  }
): Promise<{
  ast: MapDocumentNode;
  from: MapFromMetadata;
}> {
  const source = await findLocalMapSource(superJson, map);
  if (source) {
    const ast = await Parser.parseMap(
      source.source,
      `${map.profile.name}.${map.provider}`,
      {
        profileName: map.profile.name,
        scope: map.profile.scope,
        providerName: map.provider,
      }
    );
    options?.logCb?.(
      `Map: "${map.toString()}" found on local filesystem at path: "${
        source.path
      }"`
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
    const ast = await fetchMapAST(map);
    const astVersion = composeVersion(ast.header.profile.version);
    options?.logCb?.(
      `Loading map: "${map.toString()}" in version: "${astVersion}" from Superface store`
    );

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
  options?: {
    logCb?: LogCallback;
  }
): Promise<{
  source: ProviderJson;
  from: ProviderFromMetadata;
}> {
  const providerSource = await findLocalProviderSource(superJson, provider);
  if (providerSource) {
    options?.logCb?.(
      `Provider: "${provider}" found on local file system at path: "${providerSource.path}"`
    );

    return {
      source: providerSource.source,
      from: { kind: 'local', path: providerSource.path },
    };
  }
  options?.logCb?.(`Loading provider: "${provider}" from Superface store`);

  return {
    source: await fetchProviderInfo(provider),
    from: { kind: 'remote' },
  };
}
