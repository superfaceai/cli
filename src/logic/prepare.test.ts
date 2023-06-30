import { ServiceClient } from '@superfaceai/service-client';

import { MockLogger } from '../common';
import { createUserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { pollUrl } from '../common/polling';
import { UX } from '../common/ux';
import { mockProviderJson } from '../test/provider-json';
import { mockResponse } from '../test/utils';
import { prepareProviderJson } from './prepare';

jest.mock('@superfaceai/service-client');
jest.mock('../common/polling');

describe('prepareProviderJson', () => {
  const userError = createUserError(false);
  const ux = UX.create();

  const providerName = 'test-provider';
  let logger: MockLogger;
  // const userError = createUserError(false);

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(async () => {
    logger = new MockLogger();

    jest
      .spyOn(SuperfaceClient, 'getClient')
      .mockImplementation(() => new ServiceClient());
  });

  it('prepares provider json', async () => {
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
          docs_url: 'test',
          provider_id: providerName,
          definition: mockProviderJson({ name: providerName }),
        })
      );

    jest.mocked(pollUrl).mockResolvedValueOnce('https://superface.ai/job/123');

    await expect(
      prepareProviderJson(
        {
          urlOrSource: 'https://superface.ai/path/to/oas.json',
          name: providerName,
        },
        { logger, ux, userError }
      )
    ).resolves.toEqual(mockProviderJson({ name: providerName }));

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/providers', {
      body: '{"source":"https://superface.ai/path/to/oas.json","name":"test-provider"}',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    expect(pollUrl).toHaveBeenCalledWith(
      { options: { quiet: undefined }, url: 'https://superface.ai/job/123' },
      { logger, client: expect.any(ServiceClient), ux, userError }
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
      prepareProviderJson(
        {
          urlOrSource: 'https://superface.ai/path/to/oas.json',
          name: providerName,
        },
        { logger, ux, userError }
      )
    ).rejects.toEqual(Error('Unexpected status code 400 received'));

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/providers', {
      body: '{"source":"https://superface.ai/path/to/oas.json","name":"test-provider"}',
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
      prepareProviderJson(
        {
          urlOrSource: 'https://superface.ai/path/to/oas.json',
          name: providerName,
        },
        { logger, ux, userError }
      )
    ).rejects.toEqual(
      Error('Unexpected response body {"test":"test"} received')
    );

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/providers', {
      body: '{"source":"https://superface.ai/path/to/oas.json","name":"test-provider"}',
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
      prepareProviderJson(
        {
          urlOrSource: 'https://superface.ai/path/to/oas.json',
          name: providerName,
        },
        { logger, ux, userError }
      )
    ).rejects.toEqual(error);

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/providers', {
      body: '{"source":"https://superface.ai/path/to/oas.json","name":"test-provider"}',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    expect(pollUrl).toHaveBeenCalledWith(
      { options: { quiet: undefined }, url: 'https://superface.ai/job/123' },
      { logger, client: expect.any(ServiceClient), ux, userError }
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
      prepareProviderJson(
        {
          urlOrSource: 'https://superface.ai/path/to/oas.json',
          name: providerName,
        },
        { logger, ux, userError }
      )
    ).rejects.toEqual(new Error('Unexpected status code 400 received'));

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/providers', {
      body: '{"source":"https://superface.ai/path/to/oas.json","name":"test-provider"}',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    expect(pollUrl).toHaveBeenCalledWith(
      { options: { quiet: undefined }, url: 'https://superface.ai/job/123' },
      { logger, client: expect.any(ServiceClient), ux, userError }
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
      prepareProviderJson(
        {
          urlOrSource: 'https://superface.ai/path/to/oas.json',
          name: providerName,
        },
        { logger, ux, userError }
      )
    ).rejects.toEqual(new Error('Unexpected response received'));

    expect(fetch).toHaveBeenNthCalledWith(1, '/authoring/providers', {
      body: '{"source":"https://superface.ai/path/to/oas.json","name":"test-provider"}',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    expect(pollUrl).toHaveBeenCalledWith(
      { options: { quiet: undefined }, url: 'https://superface.ai/job/123' },
      { logger, client: expect.any(ServiceClient), ux, userError }
    );
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://superface.ai/job/123', {
      baseUrl: '',
      headers: { accept: 'application/json' },
      method: 'GET',
    });
  });
});
