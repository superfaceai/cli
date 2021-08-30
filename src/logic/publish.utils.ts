import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  MapDocumentNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import {
  parseProviderJson,
  Parser,
  ProviderJson,
  SuperJson,
} from '@superfaceai/one-sdk';
import { getProfileOutput, validateMap } from '@superfaceai/parser';
import { userError } from '../common/error';

import { fetchMapAST, fetchProfileAST } from '../common/http';
import { LogCallback } from '../common/log';
import { ProfileId } from '../common/profile';
import { ProfileMapReport } from '../common/report.interfaces';
import { checkMapAndProfile, CheckResult } from './check';
import { findLocalMapSource, findLocalProfileSource } from './check.utils';
import { createProfileMapReport } from './lint';

export function prePublishCheck(
  profileAst: ProfileDocumentNode,
  mapAst: MapDocumentNode,
  providerJson: ProviderJson,
  options?: { logCb?: LogCallback; warnCb?: LogCallback }
): CheckResult[] {
  try {
    options?.logCb?.('Asserting profile document')
    assertProfileDocumentNode(profileAst)
  } catch (error) {
    throw userError(error, 1)
  }
  try {
    options?.logCb?.('Asserting map document')
    assertMapDocumentNode(mapAst)
  } catch (error) {
    throw userError(error, 1)
  }

  //Check map and profile
  const result = checkMapAndProfile(profileAst, mapAst, options);

  try {
    parseProviderJson(providerJson);
  } catch (error) {
    //TODO: better way of formating?
    if ('issues' in error) {
      for (const issue of (error as { issues: [] }).issues) {
        if ('path' in issue && 'message' in issue) {
          result.push({
            kind: 'error',
            message: `Provider check error: ${(issue as { message: string }).message
              } on path ${(issue as { path: string }).path}`,
          });
        }
      }
    }
  }

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
  version?: string,
  options?: {
    logCb?: LogCallback;
  }
): Promise<{ ast: ProfileDocumentNode; source?: string }> {
  let ast: ProfileDocumentNode;

  const source = await findLocalProfileSource(superJson, {
    name: profile.name,
    scope: profile.scope,
    version,
  });

  const profileId = `${profile.scope ? `${profile.scope}/` : ''}${profile.name
    }${version ? `@${version}` : ''}`;

  if (source) {
    ast = await Parser.parseProfile(source, profileId, {
      profileName: profile.name,
      scope: profile.scope,
    });
    options?.logCb?.(`Profile: "${profileId}" found on local file system`);
  } else {
    //Load from store
    options?.logCb?.(`Loading profile: "${profileId}" from Superface store`);
    ast = await fetchProfileAST(profileId);
  }

  return { ast, source };
}
/**
 * Loads map source (if present on local filesystem) and AST (downloaded when source not found locally, compiled when found)
 */
export async function loadMap(
  superJson: SuperJson,
  profile: ProfileId,
  provider: string,
  map: {
    variant?: string;
  },
  version?: string,
  options?: {
    logCb?: LogCallback;
  }
): Promise<{ ast: MapDocumentNode; source?: string }> {
  let ast: MapDocumentNode;
  const profileId = `${profile.scope ? `${profile.scope}/` : ''}${profile.name
    }${version ? `@${version}` : ''}`;

  const source = await findLocalMapSource(superJson, profile, provider);
  if (source) {
    ast = await Parser.parseMap(source, `${profile.name}.${provider}`, {
      profileName: profile.name,
      scope: profile.scope,
      providerName: provider,
    });
    options?.logCb?.(
      `Map for profile: "${profileId}" and provider: "${provider}" found on local filesystem`
    );
  } else {
    //Load from store
    options?.logCb?.(
      `Loading map for profile: "${profileId}" and provider: "${provider}" from Superface store`
    );
    ast = await fetchMapAST(
      profile.name,
      provider,
      profile.scope,
      version,
      map.variant
    );
  }

  return { ast, source };
}
