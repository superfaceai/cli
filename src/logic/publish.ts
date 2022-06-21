import { SuperJson } from '@superfaceai/one-sdk';
import { ServiceApiError } from '@superfaceai/service-client';
import { yellow } from 'chalk';

import { ILogger, UNVERIFIED_PROVIDER_PREFIX } from '../common';
import { UserError } from '../common/error';
import { fetchProviderInfo, SuperfaceClient } from '../common/http';
import { loadNetrc } from '../common/netrc';
import { ProfileId } from '../common/profile';
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
  {
    publishing,
    superJson,
    profile,
    provider,
    map,
    version,
    options,
  }: {
    publishing: 'map' | 'profile' | 'provider';

    superJson: SuperJson;
    profile: ProfileId;
    provider: string;
    map: {
      variant?: string;
    };
    version?: string;
    options?: {
      dryRun?: boolean;
      json?: boolean;
      quiet?: boolean;
      emoji?: boolean;
      color?: boolean;
    };
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<string | undefined> {
  // Profile
  const profileFiles = await loadProfile(
    { superJson, profile, version },
    { logger }
  );
  if (profileFiles.from.kind !== 'local' && publishing === 'profile') {
    throw userError(
      `Profile: "${profile.id}" not found on local file system`,
      1
    );
  }

  // Map
  const mapFiles = await loadMap(
    { superJson, profile, provider, map, version },
    { logger }
  );
  if (mapFiles.from.kind !== 'local' && publishing == 'map') {
    throw userError(
      `Map for profile: "${profile.id}" and provider: "${provider}" not found on local filesystem`,
      1
    );
  }

  // Provider
  const providerFiles = await loadProvider(superJson, provider, { logger });

  if (providerFiles.from.kind === 'remote' && publishing === 'provider') {
    throw userError(
      `Provider: "${provider}" not found on local file system`,
      1
    );
  }

  // Check
  const checkReports = prePublishCheck(
    {
      publishing,
      profileAst: profileFiles.ast,
      mapAst: mapFiles.ast,
      providerJson: providerFiles.source,
      providerFrom: providerFiles.from,
      mapFrom: mapFiles.from,
      profileFrom: profileFiles.from,
      superJson,
    },
    { logger, userError }
  );
  const checkIssues = checkReports.flatMap(c => c.issues);

  // Lint
  const lintReport = prePublishLint(profileFiles.ast, mapFiles.ast);

  if (
    checkIssues.length !== 0 ||
    lintReport.errors.length !== 0 ||
    lintReport.warnings.length !== 0
  ) {
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
      reportStr += checkFormatHuman({
        checkResults: checkReports,
        emoji: !!options?.emoji,
        color: !!options?.color,
      });
      reportStr += yellow('\n\nLint results:\n');
      reportStr += lintFormatHuman({
        report: lintReport,
        emoji: options?.emoji ?? false,
        color: options?.color ?? false,
      });

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
        logger.info('localAndRemoteProvider', mapFiles.ast.header.provider);
      } catch (error) {
        //If provider does not exists in SF register (is not verified) it must start with unverified
        if (error instanceof ServiceApiError && error.status === 404) {
          throw userError(
            `Provider: ${mapFiles.ast.header.provider} does not exist in Superface store and it does not start with: ${UNVERIFIED_PROVIDER_PREFIX} prefix.\nPlease, rename provider: ${mapFiles.ast.header.provider} or use existing provider.`,
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
        `When publishing provider, provider name: "${providerFiles.source.name}" in provider.json must have prefix "${UNVERIFIED_PROVIDER_PREFIX}"`,
        1
      );
    }
  }

  const client = SuperfaceClient.getClient();

  if (publishing === 'provider') {
    logger.info('publishProvider', provider);
    if (!options?.dryRun) {
      await client.createProvider(JSON.stringify(providerFiles.source));
    }
  } else if (publishing === 'profile' && profileFiles.from.kind === 'local') {
    logger.info('publishProfile', profile.id);
    if (!options?.dryRun) {
      await client.createProfile(profileFiles.from.source);
    }
  } else if (publishing === 'map' && mapFiles.from.kind === 'local') {
    logger.info('publishMap', profile.id, provider);

    if (!options?.dryRun) {
      await client.createMap(mapFiles.from.source);
    }
  }

  return;
}
