import { ServiceClient } from '@superfaceai/service-client';

import { createUserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { pollUrl } from '../common/polling';
import { UX } from '../common/ux';
import { mockProviderJson } from '../test/provider-json';
import { mockResponse } from '../test/utils';
import { mapProviderToProfile } from './map';

jest.mock('@superfaceai/service-client');
jest.mock('../common/polling');

describe('mapProviderToProfile', () => {
  const userError = createUserError(false);
  const ux = UX.create();

  const providerName = 'test-provider';
  const providerJson = mockProviderJson({ name: providerName });
  const profileScope = 'test-scope';
  const profileName = 'test-profile';
  const mapSource = `js map`;
  const profileSource = ` name = "starwars/spaceship-information"
  version = "1.0.0"
  
  "Starwars Spaceship Information"
  usecase RetrieveSpaceshipInformation safe {
    input {
      spaceshipName
    }
  
    result {
      name string!
      model string!
      pilots [string]
    }
  }
  `;

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(async () => {
    jest
      .spyOn(SuperfaceClient, 'getClient')
      .mockImplementation(() => new ServiceClient());
  });

  it('prepares map', async () => {
    const fetch = jest
      .spyOn(ServiceClient.prototype, 'fetch')
      // Create job
      .mockResolvedValueOnce(
        mockResponse(202, 'ok', undefined, {
          href: 'https://superface.ai/job/123',
        })
      )
      // Fetch result
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          source: mapSource,
        })
      );

    jest.mocked(pollUrl).mockResolvedValueOnce('https://superface.ai/job/123');

    await expect(
      mapProviderToProfile(
        {
          providerJson,
          profile: {
            name: profileName,
            scope: profileScope,
            source: profileSource,
          },
        },
        { userError, ux }
      )
    ).resolves.toEqual(mapSource);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `/authoring/profiles/${profileScope}.${profileName}/maps`,
      {
        body: JSON.stringify({
          provider: providerJson,
          profile: profileSource,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }
    );
    expect(pollUrl).toHaveBeenCalledWith(
      { options: { quiet: undefined }, url: 'https://superface.ai/job/123' },
      { client: expect.any(ServiceClient), ux, userError }
    );
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://superface.ai/job/123', {
      baseUrl: '',
      headers: { accept: 'application/json' },
      method: 'GET',
    });
  });

  it('prepares map for profile without scope', async () => {
    const fetch = jest
      .spyOn(ServiceClient.prototype, 'fetch')
      // Create job
      .mockResolvedValueOnce(
        mockResponse(202, 'ok', undefined, {
          href: 'https://superface.ai/job/123',
        })
      )
      // Fetch result
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          source: mapSource,
        })
      );

    jest.mocked(pollUrl).mockResolvedValueOnce('https://superface.ai/job/123');

    await expect(
      mapProviderToProfile(
        {
          providerJson,
          profile: {
            name: profileName,
            source: profileSource,
          },
        },
        { userError, ux }
      )
    ).resolves.toEqual(mapSource);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `/authoring/profiles/${profileName}/maps`,
      {
        body: JSON.stringify({
          provider: providerJson,
          profile: profileSource,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }
    );
    expect(pollUrl).toHaveBeenCalledWith(
      { options: { quiet: undefined }, url: 'https://superface.ai/job/123' },
      { client: expect.any(ServiceClient), ux, userError }
    );
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://superface.ai/job/123', {
      baseUrl: '',
      headers: { accept: 'application/json' },
      method: 'GET',
    });
  });

  it('throws when job creation API call fails', async () => {
    const fetch = jest
      .spyOn(ServiceClient.prototype, 'fetch')
      // Create job
      .mockResolvedValueOnce(mockResponse(400, 'bad request', undefined));

    await expect(
      mapProviderToProfile(
        {
          providerJson,
          profile: {
            name: profileName,
            scope: profileScope,
            source: profileSource,
          },
        },
        { userError, ux }
      )
    ).rejects.toEqual(Error('Unexpected status code 400 received'));

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `/authoring/profiles/${profileScope}.${profileName}/maps`,
      {
        body: JSON.stringify({
          provider: providerJson,
          profile: profileSource,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }
    );
    expect(pollUrl).not.toHaveBeenCalled();
  });

  it('throws when job creation API call returns unexpected data', async () => {
    const fetch = jest
      .spyOn(ServiceClient.prototype, 'fetch')
      // Create job
      .mockResolvedValueOnce(
        mockResponse(202, 'bad request', undefined, { test: 'test' })
      );

    await expect(
      mapProviderToProfile(
        {
          providerJson,
          profile: {
            name: profileName,
            scope: profileScope,
            source: profileSource,
          },
        },
        { userError, ux }
      )
    ).rejects.toEqual(
      Error('Unexpected response body {"test":"test"} received')
    );

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `/authoring/profiles/${profileScope}.${profileName}/maps`,
      {
        body: JSON.stringify({
          provider: providerJson,
          profile: profileSource,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }
    );
    expect(pollUrl).not.toHaveBeenCalled();
  });

  it('throws when polling fails', async () => {
    const error = new Error('test error');
    const fetch = jest
      .spyOn(ServiceClient.prototype, 'fetch')
      // Create job
      .mockResolvedValueOnce(
        mockResponse(202, 'ok', undefined, {
          href: 'https://superface.ai/job/123',
        })
      );

    jest.mocked(pollUrl).mockRejectedValueOnce(error);

    await expect(
      mapProviderToProfile(
        {
          providerJson,
          profile: {
            name: profileName,
            scope: profileScope,
            source: profileSource,
          },
        },
        { userError, ux }
      )
    ).rejects.toEqual(error);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `/authoring/profiles/${profileScope}.${profileName}/maps`,
      {
        body: JSON.stringify({
          provider: providerJson,
          profile: profileSource,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }
    );
    expect(pollUrl).toHaveBeenCalledWith(
      { options: { quiet: undefined }, url: 'https://superface.ai/job/123' },
      { client: expect.any(ServiceClient), ux, userError }
    );
  });

  it('throws when fetching result returns unexpected status code', async () => {
    const fetch = jest
      .spyOn(ServiceClient.prototype, 'fetch')
      // Create job
      .mockResolvedValueOnce(
        mockResponse(202, 'ok', undefined, {
          href: 'https://superface.ai/job/123',
        })
      )
      // Fetch result
      .mockResolvedValueOnce(mockResponse(400, 'Bad Request', undefined));

    jest.mocked(pollUrl).mockResolvedValueOnce('https://superface.ai/job/123');

    await expect(
      mapProviderToProfile(
        {
          providerJson,
          profile: {
            name: profileName,
            scope: profileScope,
            source: profileSource,
          },
        },
        { userError, ux }
      )
    ).rejects.toEqual(new Error('Unexpected status code 400 received'));

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `/authoring/profiles/${profileScope}.${profileName}/maps`,
      {
        body: JSON.stringify({
          provider: providerJson,
          profile: profileSource,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }
    );
    expect(pollUrl).toHaveBeenCalledWith(
      { options: { quiet: undefined }, url: 'https://superface.ai/job/123' },
      { client: expect.any(ServiceClient), ux, userError }
    );
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://superface.ai/job/123', {
      baseUrl: '',
      headers: { accept: 'application/json' },
      method: 'GET',
    });
  });

  it('throws when fetching result returns unexpected data', async () => {
    const fetch = jest
      .spyOn(ServiceClient.prototype, 'fetch')
      // Create job
      .mockResolvedValueOnce(
        mockResponse(202, 'ok', undefined, {
          href: 'https://superface.ai/job/123',
        })
      )
      // Fetch result
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, { test: 'test' })
      );

    jest.mocked(pollUrl).mockResolvedValueOnce('https://superface.ai/job/123');

    await expect(
      mapProviderToProfile(
        {
          providerJson,
          profile: {
            name: profileName,
            scope: profileScope,
            source: profileSource,
          },
        },
        { userError, ux }
      )
    ).rejects.toEqual(new Error('Unexpected response received'));

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `/authoring/profiles/${profileScope}.${profileName}/maps`,
      {
        body: JSON.stringify({
          provider: providerJson,
          profile: profileSource,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }
    );
    expect(pollUrl).toHaveBeenCalledWith(
      { options: { quiet: undefined }, url: 'https://superface.ai/job/123' },
      { client: expect.any(ServiceClient), ux, userError }
    );
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://superface.ai/job/123', {
      baseUrl: '',
      headers: { accept: 'application/json' },
      method: 'GET',
    });
  });
});
