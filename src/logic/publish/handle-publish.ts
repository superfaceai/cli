import type { ServiceClient } from '@superfaceai/service-client';
import {
  CreateProfileApiError,
  CreateProviderApiError,
  ServiceApiError,
} from '@superfaceai/service-client';

import type { ILogger } from '../../common';
import type { UserError } from '../../common/error';

export type PublishResult = {
  skipProfile?: boolean;
  skipProvider?: boolean;
  skipMap?: boolean;
};

export async function handlePublish(
  {
    profileId,
    providerName,
    profileSource,
    providerSource,
    mapSource,
    options,
  }: {
    profileId: string;
    providerName: string;
    profileSource?: string;
    providerSource?: string;
    mapSource?: string;
    options?: { dryRun?: boolean };
  },
  {
    client,
    logger,
    userError,
  }: { client: ServiceClient; logger: ILogger; userError: UserError }
): Promise<{
  skipProfile?: boolean;
  skipProvider?: boolean;
  skipMap?: boolean;
}> {
  const result: PublishResult = {};

  if (profileSource !== undefined) {
    logger.info('publishProfile', profileId);

    try {
      await client.createProfile(profileSource, { dryRun: options?.dryRun });
    } catch (error) {
      if (
        error instanceof CreateProfileApiError &&
        error.status === 422 &&
        error.contentIsEqual === true
      ) {
        logger.info('publishSkiped', 'profile', options?.dryRun);
        result.skipProfile = true;
      } else {
        throw userError(String(error), 1);
      }
    }
    logger.success('publishSuccessful', 'profile', options?.dryRun);
  }

  if (providerSource !== undefined) {
    logger.info('publishProvider', providerName);

    try {
      await client.createProvider(providerSource, {
        dryRun: options?.dryRun,
      });
    } catch (error) {
      if (
        error instanceof CreateProviderApiError &&
        error.providerJsonEquals === true
      ) {
        logger.info('publishSkiped', 'provider', options?.dryRun);
        result.skipProvider = true;
      } else {
        throw userError(String(error), 1);
      }
    }
    logger.success('publishSuccessful', 'provider', options?.dryRun);
  }

  if (mapSource !== undefined) {
    logger.info('publishMap', profileId, providerName);

    try {
      await client.createMap(mapSource, { dryRun: options?.dryRun });
    } catch (error) {
      if (
        error instanceof ServiceApiError &&
        error.status === 422 &&
        error.title === 'No change'
      ) {
        logger.info('publishSkiped', 'map', options?.dryRun);
        result.skipMap = true;
      } else if (
        profileSource !== undefined &&
        options?.dryRun === true &&
        error instanceof ServiceApiError &&
        error.status === 422 &&
        error.title === 'Profile not found'
      ) {
        // empty
      } else {
        throw userError(String(error), 1);
      }
    }
    logger.success('publishSuccessful', 'map', options?.dryRun);
  }

  return result;
}
