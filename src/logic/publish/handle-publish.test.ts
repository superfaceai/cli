import {
  CreateProfileApiError,
  CreateProviderApiError,
  ServiceApiError,
  ServiceClient,
} from '@superfaceai/service-client';

import { MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import { handlePublish } from './handle-publish';

jest.mock('@superfaceai/service-client/dist/client');

describe('Call publish logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);

  let createMapSpy: jest.SpyInstance;
  let createProfileSpy: jest.SpyInstance;
  let createProviderSpy: jest.SpyInstance;

  const profile = 'test/profile';
  const provider = 'provider';

  const profileSource = 'profile';
  const providerSource = 'provider';
  const mapSource = 'map';

  beforeEach(() => {
    createMapSpy = jest.spyOn(ServiceClient.prototype, 'createMap');

    createProfileSpy = jest.spyOn(ServiceClient.prototype, 'createProfile');

    createProviderSpy = jest.spyOn(ServiceClient.prototype, 'createProvider');
    logger = new MockLogger();
    jest.resetAllMocks();
  });

  it('publishes profile, provider and map', async () => {
    const createMapSpy = jest.spyOn(ServiceClient.prototype, 'createMap');

    const createProfileSpy = jest.spyOn(
      ServiceClient.prototype,
      'createProfile'
    );

    const createProviderSpy = jest.spyOn(
      ServiceClient.prototype,
      'createProvider'
    );

    await handlePublish(
      {
        profileId: profile,
        profileSource: profileSource,

        providerName: provider,
        providerSource: providerSource,

        mapSource: mapSource,
      },
      {
        client: new ServiceClient(),
        logger,
        userError,
      }
    );

    expect(createProfileSpy).toHaveBeenCalledTimes(1);
    expect(createProfileSpy).toHaveBeenCalledWith('profile', {
      dryRun: undefined,
    });

    expect(createProviderSpy).toHaveBeenCalledTimes(1);
    expect(createProviderSpy).toHaveBeenCalledWith('provider', {
      dryRun: undefined,
    });

    expect(createMapSpy).toHaveBeenCalledTimes(1);
    expect(createMapSpy).toHaveBeenCalledWith('map', { dryRun: undefined });
  });

  it('passes dry run option through', async () => {
    await handlePublish(
      {
        profileId: profile,
        profileSource: profileSource,

        providerName: provider,
        providerSource: providerSource,

        mapSource: mapSource,
        options: {
          dryRun: true,
        },
      },
      {
        client: new ServiceClient(),
        logger,
        userError,
      }
    );

    expect(createProfileSpy).toHaveBeenCalledWith('profile', {
      dryRun: true,
    });

    expect(createProviderSpy).toHaveBeenCalledWith('provider', {
      dryRun: true,
    });

    expect(createMapSpy).toHaveBeenCalledWith('map', { dryRun: true });
  });

  it('returns empty object', async () => {
    const result = await handlePublish(
      {
        profileId: profile,
        profileSource: profileSource,

        providerName: provider,
        providerSource: providerSource,

        mapSource: mapSource,
        options: {
          dryRun: true,
        },
      },
      {
        client: new ServiceClient(),
        logger,
        userError,
      }
    );

    expect(result).toEqual({});
  });

  it('skippes profile publishing if already published', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const error: CreateProfileApiError = new CreateProfileApiError({
      instance: '/profile',
      status: 422,
      title: 'title',
      detail: 'detail',
      content_is_equal: true,
    });

    createProfileSpy.mockRejectedValue(error);

    const result = await handlePublish(
      {
        profileId: profile,
        profileSource: profileSource,

        providerName: provider,
        providerSource: providerSource,

        mapSource: mapSource,
      },
      {
        client: new ServiceClient(),
        logger,
        userError,
      }
    );

    expect(result).toEqual({
      skipProfile: true,
    });
  });

  it('returns error when profile already published with different content', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const error: CreateProfileApiError = new CreateProfileApiError({
      instance: '/profile',
      status: 422,
      title: 'title',
      detail: 'detail',
      content_is_equal: false,
    });

    createProfileSpy.mockRejectedValue(error);

    await expect(
      handlePublish(
        {
          profileId: profile,
          profileSource,
          providerName: provider,
          providerSource: providerSource,
          mapSource: mapSource,
        },
        {
          client: new ServiceClient(),
          logger,
          userError,
        }
      )
    ).rejects.toEqual(userError(String(error), 1));
  });

  it('skippes provider publishing if already published', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const error: CreateProviderApiError = new CreateProviderApiError({
      instance: '/profile',
      status: 403,
      title: 'title',
      detail: 'detail',
      provider_json_equals: true,
    });

    createProviderSpy.mockRejectedValue(error);

    const result = await handlePublish(
      {
        profileId: profile,
        profileSource: profileSource,

        providerName: provider,
        providerSource: providerSource,

        mapSource: mapSource,
      },
      {
        client: new ServiceClient(),
        logger,
        userError,
      }
    );

    expect(result).toEqual({ skipProvider: true });
  });

  it('retrurns error when provider already published with different content', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const error: CreateProviderApiError = new CreateProviderApiError({
      instance: '/provider',
      status: 403,
      title: 'title',
      detail: 'detail',
      provider_json_equals: false,
    });

    createProviderSpy.mockRejectedValue(error);
    await expect(
      handlePublish(
        {
          profileId: profile,
          profileSource,

          providerName: provider,
          providerSource: providerSource,

          mapSource: mapSource,
        },
        {
          client: new ServiceClient(),
          logger,
          userError,
        }
      )
    ).rejects.toEqual(userError(String(error), 1));
  });

  it('skippes map publishing if already published', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const error: ServiceApiError = new ServiceApiError({
      instance: '/map',
      status: 422,
      title: 'No change',
      detail: 'detail',
    });

    createMapSpy.mockRejectedValue(error);

    const result = await handlePublish(
      {
        profileId: profile,
        profileSource,

        providerName: provider,
        providerSource: providerSource,

        mapSource: mapSource,
      },
      {
        client: new ServiceClient(),
        logger,
        userError,
      }
    );

    expect(result).toEqual({ skipMap: true });
  });
});
