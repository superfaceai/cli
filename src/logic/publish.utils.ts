import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  MapDocumentNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { Parser, ProviderJson, SuperJson } from '@superfaceai/one-sdk';
import {
  getProfileOutput,
  MapId,
  ProfileId,
  validateMap,
} from '@superfaceai/parser';

import { userError } from '../common/error';
import { fetchMapAST, fetchProfileAST } from '../common/http';
import { LogCallback } from '../common/log';
import { ProfileMapReport } from '../common/report.interfaces';
import { checkMapAndProfile, checkMapAndProvider, CheckResult } from './check';
import { findLocalMapSource, findLocalProfileSource } from './check.utils';
import { createProfileMapReport } from './lint';

export function prePublishCheck(
  publishing: 'map' | 'profile' | 'provider',
  profileAst: ProfileDocumentNode,
  mapAst: MapDocumentNode,
  providerJson: ProviderJson,
  options?: { logCb?: LogCallback; warnCb?: LogCallback }
): CheckResult[] {
  try {
    options?.logCb?.('Asserting profile document');
    assertProfileDocumentNode(profileAst);
  } catch (error) {
    throw userError(error, 1);
  }
  try {
    options?.logCb?.('Asserting map document');
    assertMapDocumentNode(mapAst);
  } catch (error) {
    throw userError(error, 1);
  }

  //Check map and profile
  const result = checkMapAndProfile(profileAst, mapAst, {
    //strict when we are publishing profile or map
    strict: publishing !== 'provider',
    logCb: options?.logCb,
  });

  //Check map and provider
  result.push(...checkMapAndProvider(providerJson, mapAst));

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
 * Loads profile source (if present on local filesystem) and AST (downloaded when source not found locally, compiled when found)
 */
export async function loadProfile(
  superJson: SuperJson,
  profile: ProfileId,
  options?: {
    logCb?: LogCallback;
  }
): Promise<{ ast: ProfileDocumentNode; source?: string }> {
  let ast: ProfileDocumentNode;

  const source = await findLocalProfileSource(superJson, profile);

  if (source) {
    ast = await Parser.parseProfile(source, profile.toString(), {
      profileName: profile.name,
      scope: profile.scope,
    });
    options?.logCb?.(
      `Profile: "${profile.toString()}" found on local file system`
    );
  } else {
    //Load from store
    options?.logCb?.(
      `Loading profile: "${profile.toString()}" from Superface store`
    );
    ast = await fetchProfileAST(profile);
  }

  return { ast, source };
}
/**
 * Loads map source (if present on local filesystem) and AST (downloaded when source not found locally, compiled when found)
 */
export async function loadMap(
  map: MapId,
  superJson: SuperJson,
  options?: {
    logCb?: LogCallback;
  }
): Promise<{ ast: MapDocumentNode; source?: string }> {
  let ast: MapDocumentNode;
  const source = await findLocalMapSource(superJson, map);
  if (source) {
    ast = await Parser.parseMap(source, `${map.profile.name}.${map.provider}`, {
      profileName: map.profile.name,
      scope: map.profile.scope,
      providerName: map.provider,
    });
    options?.logCb?.(`Map: "${map.toString()}" found on local filesystem`);
  } else {
    //Load from store
    options?.logCb?.(`Loading map: "${map.toString()}" from Superface store`);
    ast = await fetchMapAST(map);
  }

  return { ast, source };
}
