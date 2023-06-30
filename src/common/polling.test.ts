import type { ServiceClient } from '@superfaceai/service-client';

import { mockResponse } from '../test/utils';
import { createUserError } from './error';
import { pollUrl } from './polling';
import { UX } from './ux';

const mockFetch = jest.fn();

describe('polling', () => {
  const jobUrl = 'https://superface.ai/job/123';
  const client = { fetch: mockFetch } as unknown as jest.Mocked<ServiceClient>;
  const userError = createUserError(false);
  const ux = UX.create();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('polls until job is done', async () => {
    const resultUrl = 'https://superface.ai/resource/1';

    mockFetch
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Pending',
          result_type: 'Provider',
          events: [
            { type: 'info', description: 'first', occuredAt: new Date() },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Pending',
          result_type: 'Provider',
          events: [
            { type: 'info', description: 'second', occuredAt: new Date() },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Success',
          result_type: 'Provider',
          result_url: resultUrl,
        })
      );

    await expect(
      pollUrl(
        {
          url: jobUrl,
          options: { quiet: false },
        },
        { client, ux, userError }
      )
    ).resolves.toEqual(resultUrl);

    expect(mockFetch).toHaveBeenCalledTimes(3);

    expect(mockFetch).toHaveBeenCalledWith(jobUrl, {
      method: 'GET',
      baseUrl: '',
      headers: {
        accept: 'application/json',
      },
    });
  });

  it('polls until job is cancelled', async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Pending',
          result_type: 'Provider',
          events: [
            { type: 'info', description: 'first', occuredAt: new Date() },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Pending',
          result_type: 'Provider',
          events: [
            { type: 'info', description: 'second', occuredAt: new Date() },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          result_type: 'Provider',
          status: 'Cancelled',
        })
      );

    await expect(
      pollUrl(
        {
          url: jobUrl,
          options: { quiet: false },
        },
        { client, ux, userError }
      )
    ).rejects.toThrow(
      'Failed to prepare provider: Operation has been cancelled.'
    );

    expect(mockFetch).toHaveBeenCalledTimes(3);

    expect(mockFetch).toHaveBeenCalledWith(jobUrl, {
      method: 'GET',
      baseUrl: '',
      headers: {
        accept: 'application/json',
      },
    });
  });

  it('polls until job fails', async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Pending',
          result_type: 'Provider',
          events: [
            { type: 'info', description: 'first', occuredAt: new Date() },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Pending',
          result_type: 'Provider',
          events: [
            { type: 'info', description: 'second', occuredAt: new Date() },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Failed',
          result_type: 'Provider',
          failure_reason: 'test',
        })
      );

    await expect(
      pollUrl(
        {
          url: jobUrl,
          options: { quiet: false },
        },
        { client, ux, userError }
      )
    ).rejects.toThrow('test');

    expect(mockFetch).toHaveBeenCalledTimes(3);

    expect(mockFetch).toHaveBeenCalledWith(jobUrl, {
      method: 'GET',
      baseUrl: '',
      headers: {
        accept: 'application/json',
      },
    });
  });

  it('polls until timeout', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, 'ok', undefined, {
        status: 'Pending',
        result_type: 'Provider',
        events: [{ type: 'info', description: 'first', occuredAt: new Date() }],
      })
    );

    await expect(
      pollUrl(
        {
          url: jobUrl,
          options: {
            quiet: false,
            pollingTimeoutSeconds: 1,
            pollingIntervalSeconds: 1,
          },
        },
        { client, ux, userError }
      )
    ).rejects.toThrow('Operation timed out after 1000 milliseconds');

    expect(mockFetch).toHaveBeenCalledTimes(1);

    expect(mockFetch).toHaveBeenCalledWith(jobUrl, {
      method: 'GET',
      baseUrl: '',
      headers: {
        accept: 'application/json',
      },
    });
  });

  it('throws when fetch returns unexpected status code', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(400, 'Bad Request', undefined)
    );

    await expect(
      pollUrl(
        {
          url: jobUrl,
          options: {
            quiet: false,
          },
        },
        { client, ux, userError }
      )
    ).rejects.toThrow('Unexpected status code 400 received');

    expect(mockFetch).toHaveBeenCalledTimes(1);

    expect(mockFetch).toHaveBeenCalledWith(jobUrl, {
      method: 'GET',
      baseUrl: '',
      headers: {
        accept: 'application/json',
      },
    });
  });

  it('throws when fetch returns unexpected body', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, 'ok', undefined, { foo: 'bar' })
    );

    await expect(
      pollUrl(
        {
          url: jobUrl,
          options: {
            quiet: false,
          },
        },
        { client, ux, userError }
      )
    ).rejects.toThrow(`Unexpected response from server: {
  "foo": "bar"
}`);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    expect(mockFetch).toHaveBeenCalledWith(jobUrl, {
      method: 'GET',
      baseUrl: '',
      headers: {
        accept: 'application/json',
      },
    });
  });

  describe('result type specific error', () => {
    it('returns prepare provider specific error', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Failed',
          result_type: 'Provider',
          failure_reason: 'test',
        })
      );

      await expect(
        pollUrl(
          {
            url: jobUrl,
            options: { quiet: false },
          },
          { client, ux, userError }
        )
      ).rejects.toThrow('Failed to prepare provider: test');
    });

    it('returns create profile specific error', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Failed',
          result_type: 'Profile',
          failure_reason: 'test',
        })
      );

      await expect(
        pollUrl(
          {
            url: jobUrl,
            options: { quiet: false },
          },
          { client, ux, userError }
        )
      ).rejects.toThrow('Failed to create profile: test');
    });

    it('returns create map specific error', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Failed',
          result_type: 'Map',
          failure_reason: 'test',
        })
      );

      await expect(
        pollUrl(
          {
            url: jobUrl,
            options: { quiet: false },
          },
          { client, ux, userError }
        )
      ).rejects.toThrow('Failed to create map: test');
    });
  });
});
