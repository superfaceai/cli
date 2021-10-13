import { SuperJson } from '@superfaceai/one-sdk';
import { MapId, ProfileId } from '@superfaceai/parser';
import { ServiceApiError } from '@superfaceai/service-client';
import { yellow } from 'chalk';

import { UNVERIFIED_PROVIDER_PREFIX } from '../common';
import { userError } from '../common/error';
import { fetchProviderInfo, SuperfaceClient } from '../common/http';
import { LogCallback } from '../common/log';
import { loadNetrc } from '../common/netrc';
import {
  formatHuman as checkFormatHuman,
  formatJson as checkFormatJson,
} from './check';
import {
  formatHuman as lintFormatHuman,
  formatJson as lintFormatJson,
} from './lint';
import {
  loadMap,
  loadProfile,
  loadProvider,
  prePublishCheck,
  prePublishLint,
} from './publish.utils';

export async function publish(
  publishing: 'map' | 'profile' | 'provider',
  superJson: SuperJson,
  profile: ProfileId,
  map: MapId,
  options?: {
    logCb?: LogCallback;
    dryRun?: boolean;
    json?: boolean;
    quiet?: boolean;
  }
): Promise<string | undefined> {
  //Profile
  const profileFiles = await loadProfile(superJson, profile, options);

  if (profileFiles.from.kind !== 'local' && publishing === 'profile') {
    throw userError(
      `Profile: "${profile.toString()}" not found on local file system`,
      1
    );
  }
  //Map
  const mapFiles = await loadMap(map, superJson, options);

  if (mapFiles.from.kind !== 'local' && publishing == 'map') {
    throw userError(
      `Map: "${map.toString()}" not found on local filesystem`,
      1
    );
  }

  //Provider
  const providerFiles = await loadProvider(superJson, map.provider, options);

  if (providerFiles.from.kind === 'remote' && publishing === 'provider') {
    throw userError(
      `Provider: "${map.provider}" not found on local file system`,
      1
    );
  }
  //Check
  const checkReports = prePublishCheck({
    publishing,
    profileAst: profileFiles.ast,
    mapAst: mapFiles.ast,
    providerJson: providerFiles.source,
    providerFrom: providerFiles.from,
    mapFrom: mapFiles.from,
    profileFrom: profileFiles.from,
  });
  const checkIssues = checkReports.flatMap(c => c.issues);
  //Lint
  const lintReport = prePublishLint(profileFiles.ast, mapFiles.ast);

  if (
    checkIssues.length !== 0 ||
    lintReport.errors.length !== 0 ||
    lintReport.warnings.length !== 0
  ) {
    //Format reports
    if (options?.json) {
      return JSON.stringify({
        check: {
          reports: checkFormatJson(checkReports),
          total: {
            errors: checkIssues.filter(issue => issue.kind === 'error').length,
            warnings: checkIssues.filter(issue => issue.kind === 'warn').length,
          },
        },
        lint: {
          reports: lintFormatJson(lintReport),
          total: {
            errors: lintReport.errors.length,
            warnings: lintReport.warnings.length,
          },
        },
      });
    } else {
      let reportStr = yellow('Check results:\n');
      reportStr += checkFormatHuman(checkReports);
      reportStr += yellow('\n\nLint results:\n');
      reportStr += lintFormatHuman(lintReport, options?.quiet ?? false);

      return reportStr;
    }
  }

  //check if user is logged in
  const netRc = loadNetrc();
  if (!netRc.refreshToken && !process.env.SUPERFACE_REFRESH_TOKEN) {
    throw userError(
      `You have to be logged in to publish ${publishing}. Please run: "sf login"`,
      1
    );
  }

  //Check provider name
  if (publishing === 'map') {
    //If we are working with local provider and name does not start with unverified we check existance of provider in SF register
    if (
      !mapFiles.ast.header.provider.startsWith(UNVERIFIED_PROVIDER_PREFIX) &&
      providerFiles.from.kind === 'local'
    ) {
      try {
        await fetchProviderInfo(mapFiles.ast.header.provider);
        //Log if provider exists in SF and user is using local one
        options?.logCb?.(
          `Provider: "${mapFiles.ast.header.provider}" found localy linked in super.json and also in Superface server. Consider using provider from Superface store.`
        );
      } catch (error) {
        //If provider does not exists in SF register (is not verified) it must start with unverified
        if (error instanceof ServiceApiError && error.status === 404) {
          throw userError(
            `Provider: "${mapFiles.ast.header.provider}" does not exist in Superface store and it does not start with: "${UNVERIFIED_PROVIDER_PREFIX}" prefix.\nPlease, rename provider: "${mapFiles.ast.header.provider}" or use existing provider.`,
            1
          );
        } else {
          throw error;
        }
      }
    }
  }
  if (publishing === 'provider') {
    if (!providerFiles.source.name.startsWith(UNVERIFIED_PROVIDER_PREFIX)) {
      throw userError(
        `❌ When publishing provider, provider name: "${providerFiles.source.name}" in provider.json must have prefix "${UNVERIFIED_PROVIDER_PREFIX}"`,
        1
      );
    }
  }

  const client = SuperfaceClient.getClient();

  if (publishing === 'provider') {
    options?.logCb?.(`Publishing provider "${map.provider}"`);
    if (!options?.dryRun) {
      await client.createProvider(JSON.stringify(providerFiles.source));
    }
  } else if (publishing === 'profile' && profileFiles.from.kind === 'local') {
    options?.logCb?.(`Publishing profile "${profile.name}"`);
    if (!options?.dryRun) {
      await client.createProfile(profileFiles.from.source);
    }
  } else if (publishing === 'map' && mapFiles.from.kind === 'local') {
    options?.logCb?.(
      `Publishing map for profile "${profile.name}" and provider "${map.provider}"`
    );

    if (!options?.dryRun) {
      await client.createMap(mapFiles.from.source);
    }
  }

  return;
}
