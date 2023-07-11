import { ServiceClient } from '@superfaceai/service-client';

import { createUserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { pollUrl } from '../common/polling';
import { UX } from '../common/ux';
import { mockProviderJson } from '../test/provider-json';
import { mockResponse } from '../test/utils';
import { newProfile } from './new';

jest.mock('@superfaceai/service-client');
jest.mock('../common/polling');

describe('newProfile', () => {
  const userError = createUserError(false);
  const ux = UX.create();
  const mockProvider = mockProviderJson({ name: 'test-provider' });
  const prompt = 'test';
  const mockProfileScope = 'test-scope';
  const mockProfileName = 'test-name';
  const mockProfileSource = (
    scope: string | undefined,
    name: string
  ) => `name = "${scope !== undefined ? scope + '/' : ''}${name}"
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

  it('prepares profile with . in id', async () => {
    const source = mockProfileSource(mockProfileScope, mockProfileName);
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
          id: mockProfileScope + '.' + mockProfileName,
          profile: { source },
        })
      );

    jest.mocked(pollUrl).mockResolvedValueOnce('https://superface.ai/job/123');

    await expect(
      newProfile(
        {
          providerJson: mockProvider,
          prompt,
        },
        { userError, ux }
      )
    ).resolves.toEqual({
      scope: mockProfileScope,
      name: mockProfileName,
      source,
    });

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/profiles', {
      body: JSON.stringify({ prompt, provider: mockProvider }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
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

  it('prepares profile with / in id', async () => {
    const source = mockProfileSource(mockProfileScope, mockProfileName);
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
          id: mockProfileScope + '/' + mockProfileName,
          profile: { source },
        })
      );

    jest.mocked(pollUrl).mockResolvedValueOnce('https://superface.ai/job/123');

    await expect(
      newProfile(
        {
          providerJson: mockProvider,
          prompt,
        },
        { userError, ux }
      )
    ).resolves.toEqual({
      scope: mockProfileScope,
      name: mockProfileName,
      source,
    });

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/profiles', {
      body: JSON.stringify({ prompt, provider: mockProvider }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
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

  it('prepares profile without scope', async () => {
    const source = mockProfileSource(mockProfileScope, mockProfileName);
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
          id: mockProfileName,
          profile: { source },
        })
      );

    jest.mocked(pollUrl).mockResolvedValueOnce('https://superface.ai/job/123');

    await expect(
      newProfile(
        {
          providerJson: mockProvider,
          prompt,
        },
        { ux, userError }
      )
    ).resolves.toEqual({
      name: mockProfileName,
      source,
    });

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/profiles', {
      body: JSON.stringify({ prompt, provider: mockProvider }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
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
      newProfile(
        {
          providerJson: mockProvider,
          prompt,
        },
        { userError, ux }
      )
    ).rejects.toEqual(Error('Unexpected status code 400 received'));

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/profiles', {
      body: JSON.stringify({ prompt, provider: mockProvider }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    expect(pollUrl).not.toHaveBeenCalled();
  });

  it('throws when job creation API call fails with 401', async () => {
    const fetch = jest
      .spyOn(ServiceClient.prototype, 'fetch')
      // Create job
      .mockResolvedValueOnce(mockResponse(401, 'forgot to log in', undefined));

    await expect(
      newProfile(
        {
          providerJson: mockProvider,
          prompt,
        },
        { userError, ux }
      )
    ).rejects.toEqual(
      userError(
        "You are not authorized. Please login using 'superface login'.",
        1
      )
    );

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/profiles', {
      body: JSON.stringify({ prompt, provider: mockProvider }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
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
      newProfile(
        {
          providerJson: mockProvider,
          prompt,
        },
        { userError, ux }
      )
    ).rejects.toEqual(
      Error('Unexpected response body {"test":"test"} received')
    );

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/profiles', {
      body: JSON.stringify({ prompt, provider: mockProvider }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
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
      newProfile(
        {
          providerJson: mockProvider,
          prompt,
        },
        { userError, ux }
      )
    ).rejects.toEqual(error);

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/profiles', {
      body: JSON.stringify({ prompt, provider: mockProvider }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
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
      newProfile(
        {
          providerJson: mockProvider,
          prompt,
        },
        { userError, ux }
      )
    ).rejects.toEqual(new Error('Unexpected status code 400 received'));

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/profiles', {
      body: JSON.stringify({ prompt, provider: mockProvider }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
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
      newProfile(
        {
          providerJson: mockProvider,
          prompt,
        },
        { userError, ux }
      )
    ).rejects.toEqual(new Error('Unexpected response received'));

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/profiles', {
      body: JSON.stringify({ prompt, provider: mockProvider }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
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
