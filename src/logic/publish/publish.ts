import type { SuperJsonDocument } from '@superfaceai/ast';
import { ServiceApiError } from '@superfaceai/service-client';
import { yellow } from 'chalk';

import type { ILogger } from '../../common';
import { UNVERIFIED_PROVIDER_PREFIX } from '../../common';
import type { UserError } from '../../common/error';
import { fetchProviderInfo, SuperfaceClient } from '../../common/http';
import { loadNetrc } from '../../common/netrc';
import type { ProfileId } from '../../common/profile';
import {
  formatHuman as checkFormatHuman,
  formatJson as checkFormatJson,
} from '../check';
import {
  formatHuman as lintFormatHuman,
  formatJson as lintFormatJson,
} from '../lint';
import { handlePublish } from './handle-publish';
import {
  loadMap,
  loadProfile,
  loadProvider,
  prePublishCheck,
  prePublishLint,
} from './publish.utils';

/**
 * Load files
 * Lint
 * Check
 * DryRun check
 * Publish
 */
export async function publish(
  {
    publishing,
    superJson,
    superJsonPath,
    profile,
    provider,
    map,
    version,
    options,
  }: {
    publishing: { map: boolean; profile: boolean; provider: boolean };
    superJson: SuperJsonDocument;
    superJsonPath: string;
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
    { superJson, superJsonPath, profile, version },
    { logger }
  );
  if (profileFiles.from.kind !== 'local' && publishing.profile) {
    throw userError(
      `Profile: "${profile.id}" not found on local file system`,
      1
    );
  }

  // Map
  const mapFiles = await loadMap(
    { superJson, superJsonPath, profile, provider, map, version },
    { logger }
  );
  if (mapFiles.from.kind !== 'local' && publishing.map) {
    throw userError(
      `Map for profile: "${profile.id}" and provider: "${provider}" not found on local filesystem`,
      1
    );
  }

  // Provider
  const providerFiles = await loadProvider(superJson, superJsonPath, provider, {
    logger,
  });

  if (providerFiles.from.kind === 'remote' && publishing.provider) {
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
      superJsonPath,
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
    if (options?.json === true) {
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
        emoji: options?.emoji ?? true,
        color: options?.color ?? true,
      });
      reportStr += yellow('\n\nLint results:\n');
      reportStr += lintFormatHuman({
        report: lintReport,
        emoji: options?.emoji ?? true,
        color: options?.color ?? true,
      });

      return reportStr;
    }
  }

  // check if user is logged in
  const netRc = loadNetrc();
  if (
    netRc.refreshToken === undefined &&
    process.env.SUPERFACE_REFRESH_TOKEN === undefined
  ) {
    throw userError(
      `You have to be logged in to publish files. Please run: "superface login"`,
      1
    );
  }

  // Check provider name
  if (publishing.map) {
    // If we are working with local provider and name does not start with unverified we check existance of provider in SF register
    if (
      !mapFiles.ast.header.provider.startsWith(UNVERIFIED_PROVIDER_PREFIX) &&
      providerFiles.from.kind === 'local'
    ) {
      try {
        await fetchProviderInfo(mapFiles.ast.header.provider);
        // Log if provider exists in SF and user is using local one
        logger.info('localAndRemoteProvider', mapFiles.ast.header.provider);
      } catch (error) {
        // If provider does not exists in SF register (is not verified) it must start with unverified
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
  if (publishing.provider) {
    if (!providerFiles.source.name.startsWith(UNVERIFIED_PROVIDER_PREFIX)) {
      throw userError(
        `When publishing provider, provider name: "${providerFiles.source.name}" in provider.json must have prefix "${UNVERIFIED_PROVIDER_PREFIX}"`,
        1
      );
    }
  }

  const profileSource =
    publishing.profile && profileFiles.from.kind === 'local'
      ? profileFiles.from.source
      : undefined;
  const mapSource =
    publishing.map && mapFiles.from.kind === 'local'
      ? mapFiles.from.source
      : undefined;
  const providerSource = publishing.provider
    ? JSON.stringify(providerFiles.source)
    : undefined;

  const client = SuperfaceClient.getClient();

  const dryRunResult = await handlePublish(
    {
      profileId: profile.id,
      profileSource: profileSource,
      providerName: provider,
      providerSource: providerSource,
      mapSource,
      options: { dryRun: true },
    },
    { logger, userError, client }
  );

  await handlePublish(
    {
      profileId: profile.id,
      profileSource:
        dryRunResult.skipProfile === true ? undefined : profileSource,
      providerName: provider,
      providerSource:
        dryRunResult.skipProvider === true ? undefined : providerSource,
      mapSource: dryRunResult.skipMap === true ? undefined : mapSource,
      options: { dryRun: true },
    },
    { logger, userError, client }
  );

  return;
}
