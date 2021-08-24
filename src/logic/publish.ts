import { SuperJson } from '@superfaceai/one-sdk';
import { yellow } from 'chalk';

import { userError } from '../common/error';
import { fetchProviderInfo, SuperfaceClient } from '../common/http';
import { LogCallback } from '../common/log';
import { ProfileId } from '../common/profile';
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
  provider: string,
  map: {
    variant?: string;
  },
  version?: string,
  options?: {
    logCb?: LogCallback;
    dryRun?: boolean;
    json?: boolean;
    quiet?: boolean;
  }
): Promise<string | undefined> {
  //Profile
  const profileFiles = await loadProfile(superJson, profile, version, options);
  if (!profileFiles.source && publishing === 'profile') {
    throw userError(
      `Profile: "${profile.id}" not found on local file system`,
      1
    );
  }
  //Map
  const mapFiles = await loadMap(
    superJson,
    profile,
    provider,
    map,
    version,
    options
  );
  if (!mapFiles.source && publishing == 'map') {
    throw userError(
      `Map for profile: "${profile.id}" and provider: "${provider}" not found on local filesystem`,
      1
    );
  }

  //Provider
  let providerJson;
  const localProviderJson = await findLocalProviderSource(superJson, provider);
  if (!localProviderJson && publishing === 'provider') {
    throw userError(
      `Provider: "${provider}" not found on local file system`,
      1
    );
  }
  if (localProviderJson) {
    providerJson = localProviderJson;
    options?.logCb?.(`Provider: "${provider}" found on local file system`);
  } else {
    options?.logCb?.(`Loading provider: "${provider}" from Superface store`);
    providerJson = await fetchProviderInfo(provider);
  }

  //Check
  const checkReport = prePublishCheck(
    profileFiles.ast,
    mapFiles.ast,
    providerJson
  );
  //Lint
  const lintReport = prePublishLint(profileFiles.ast, mapFiles.ast);

  //TODO: do we want to be this strict?
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

  //TODO: check if user is logged in
  const client = SuperfaceClient.getClient();

  if (publishing === 'provider') {
    options?.logCb?.(`Publishing provider ${provider}`);
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
      `Publishing map for profile "${profile.name}" and provider "${provider}"`
    );

    if (!options?.dryRun) {
      await client.createMap(mapFiles.source);
    }
  }

  return;
}
