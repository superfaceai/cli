import type { ProviderJson, SuperJsonDocument } from '@superfaceai/ast';
import {
  CreateProfileApiError,
  CreateProviderApiError,
  ServiceApiError,
  ServiceClient,
} from '@superfaceai/service-client';
import { yellow } from 'chalk';

import type { ILogger } from '../common';
import { UNVERIFIED_PROVIDER_PREFIX } from '../common';
import type { UserError } from '../common/error';
import { fetchProviderInfo, SuperfaceClient } from '../common/http';
import { loadNetrc } from '../common/netrc';
import type { ProfileId } from '../common/profile';
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

  const client = SuperfaceClient.getClient();

  if (publishing.profile && profileFiles.from.kind === 'local') {
    await publishProfile(
      profile,
      profileFiles.from.source,
      options?.dryRun ?? false,
      { client, logger, userError }
    );
  }
  if (publishing.provider) {
    await publishProvider(providerFiles.source, options?.dryRun ?? false, {
      client,
      logger,
      userError,
    });
  }

  if (publishing.map && mapFiles.from.kind === 'local') {
    await publishMap(
      profile,
      provider,
      mapFiles.from.source,
      options?.dryRun ?? false,
      { client, logger, userError }
    );
  }

  return;
}

async function publishMap(
  profile: ProfileId,
  provider: string,
  mapSource: string,
  dryRun: boolean,
  {
    client,
    logger,
    userError,
  }: { client: ServiceClient; logger: ILogger; userError: UserError }
) {
  logger.info('publishMap', profile.id, provider);

  try {
    await client.createMap(mapSource, { dryRun: true });
  } catch (error) {
    if (
      dryRun &&
      error instanceof ServiceApiError &&
      error.status === 422 &&
      error.title === 'Profile not found'
    ) {
      console.log('IT')
    } else if (error instanceof ServiceApiError) {
      throw userError(error.message, 1);
    } else {
      throw userError(String(error), 1);
    }
  }
  console.log('Map publish dry run ok');


  if (!dryRun) {
    try {
      await client.createMap(mapSource);
      console.log('Map publish dry run ok');
    } catch (error) {
      if (error instanceof ServiceApiError) {
        throw userError(error.message, 1);
      }
      throw userError(String(error), 1);
    }
  }
}

async function publishProvider(
  providerJson: ProviderJson,
  dryRun: boolean,
  {
    client,
    logger,
    userError,
  }: { client: ServiceClient; logger: ILogger; userError: UserError }
) {
  logger.info('publishProvider', providerJson.name);
  try {
    await client.createProvider(JSON.stringify(providerJson), {
      dryRun: true,
    });
    console.log('Provider publish dry run ok');
  } catch (error) {
    if (error instanceof CreateProviderApiError) {
      throw userError(error.message, 1);
    }
    throw userError(String(error), 1);
  }

  if (!dryRun) {
    try {
      await client.createProvider(JSON.stringify(providerJson));
      console.log('Provider publish ok');
    } catch (error) {
      if (error instanceof CreateProviderApiError) {
        throw userError(error.message, 1);
      }
      throw userError(String(error), 1);
    }
  }
}

async function publishProfile(
  profileId: ProfileId,
  profileSource: string,
  dryRun: boolean,
  {
    client,
    logger,
    userError,
  }: { client: ServiceClient; logger: ILogger; userError: UserError }
) {
  logger.info('publishProfile', profileId.id);
  try {
    await client.createProfile(profileSource, {
      dryRun: true,
    });
    console.log('Profile publish dry run ok');
  } catch (error) {
    //TODO: does this make sense?
    if (
      error instanceof CreateProfileApiError &&
      error.status === 422 &&
      error.contentIsEqual
    ) {
      throw userError(
        `Profile ${profileId.id} already exists in Registry. Did you forget to update profile version?`,
        1
      );
    }
    throw userError(String(error), 1);
  }

  if (!dryRun) {
    try {
      await client.createProfile(profileSource);
      console.log('Profile publish ok');
    } catch (error) {
      if (error instanceof CreateProfileApiError) {
        throw userError(error.message, 1);
      }
      throw userError(String(error), 1);
    }
  }
}
