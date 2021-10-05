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
import { findLocalProviderSource } from './check.utils';
import {
  formatHuman as lintFormatHuman,
  formatJson as lintFormatJson,
} from './lint';
import {
  loadMap,
  loadProfile,
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
  if (!profileFiles.source && publishing === 'profile') {
    throw userError(
      `Profile: "${profile.toString()}" not found on local file system`,
      1
    );
  }
  //Map
  const mapFiles = await loadMap(map, superJson, options);
  if (!mapFiles.source && publishing == 'map') {
    throw userError(
      `Map: "${map.toString()}" not found on local filesystem`,
      1
    );
  }

  //Provider
  let providerJson;
  const localProviderJson = await findLocalProviderSource(
    superJson,
    map.provider
  );
  if (!localProviderJson && publishing === 'provider') {
    throw userError(
      `Provider: "${map.provider}" not found on local file system`,
      1
    );
  }
  if (localProviderJson) {
    providerJson = localProviderJson;
    options?.logCb?.(`Provider: "${map.provider}" found on local file system`);
  } else {
    options?.logCb?.(
      `Loading provider: "${map.provider}" from Superface store`
    );
    providerJson = await fetchProviderInfo(map.provider);
  }

  //Check
  const checkReport = prePublishCheck(
    publishing,
    profileFiles.ast,
    mapFiles.ast,
    providerJson
  );
  //Lint
  const lintReport = prePublishLint(profileFiles.ast, mapFiles.ast);

  if (
    checkReport.length !== 0 ||
    lintReport.errors.length !== 0 ||
    lintReport.warnings.length !== 0
  ) {
    //Format reports
    if (options?.json) {
      return JSON.stringify({
        check: {
          reports: checkFormatJson(checkReport),
          total: {
            errors: checkReport.filter(result => result.kind === 'error')
              .length,
            warnings: checkReport.filter(result => result.kind === 'warn')
              .length,
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
      reportStr += checkFormatHuman(checkReport);
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
      localProviderJson
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
    if (!providerJson.name.startsWith(UNVERIFIED_PROVIDER_PREFIX)) {
      throw userError(
        `❌ When publishing provider, provider name: "${providerJson.name}" in provider.json must have prefix "${UNVERIFIED_PROVIDER_PREFIX}"`,
        1
      );
    }
  }

  const client = SuperfaceClient.getClient();

  if (publishing === 'provider') {
    options?.logCb?.(`Publishing provider "${map.provider}"`);
    if (!options?.dryRun) {
      await client.createProvider(JSON.stringify(providerJson));
    }
  } else if (publishing === 'profile' && profileFiles.source) {
    options?.logCb?.(`Publishing profile "${profile.name}"`);
    if (!options?.dryRun) {
      await client.createProfile(profileFiles.source);
    }
  } else if (publishing === 'map' && mapFiles.source) {
    options?.logCb?.(
      `Publishing map for profile "${profile.name}" and provider "${map.provider}"`
    );

    if (!options?.dryRun) {
      await client.createMap(mapFiles.source);
    }
  }

  return;
}
