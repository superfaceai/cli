import type { ServiceClient } from '@superfaceai/service-client';

import { mockResponse } from '../test/utils';
import { MockLogger } from './log';
import { pollUrl } from './polling';

const mockFetch = jest.fn();

describe('polling', () => {
  const jobUrl = 'https://superface.ai/job/123';
  let logger: MockLogger;
  const client = { fetch: mockFetch } as unknown as jest.Mocked<ServiceClient>;

  beforeEach(() => {
    logger = new MockLogger();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('polls until job is done', async () => {
    const resultUrl = 'https://superface.ai/resource/1';

    mockFetch
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Pending',
          events: [
            { type: 'info', description: 'first', occuredAt: new Date() },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Pending',
          events: [
            { type: 'info', description: 'second', occuredAt: new Date() },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Successful',
          result_url: resultUrl,
        })
      );

    await expect(
      pollUrl(
        {
          url: jobUrl,
          options: { quiet: false },
        },
        { logger, client }
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

    expect(logger.stdout).toEqual([
      ['pollingEvent', ['info', 'first']],
      ['pollingEvent', ['info', 'second']],
    ]);
  });

  it('polls until job fails', async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Pending',
          events: [
            { type: 'info', description: 'first', occuredAt: new Date() },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Pending',
          events: [
            { type: 'info', description: 'second', occuredAt: new Date() },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, 'ok', undefined, {
          status: 'Failed',
          failure_reason: 'test',
        })
      );

    await expect(
      pollUrl(
        {
          url: jobUrl,
          options: { quiet: false },
        },
        { logger, client }
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

    expect(logger.stdout).toEqual([
      ['pollingEvent', ['info', 'first']],
      ['pollingEvent', ['info', 'second']],
    ]);
  });

  it('polls until timeout', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, 'ok', undefined, {
        status: 'Pending',
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
        { logger, client }
      )
    ).rejects.toThrow('Polling timed out after 1000 milliseconds');

    expect(mockFetch).toHaveBeenCalledTimes(1);

    expect(mockFetch).toHaveBeenCalledWith(jobUrl, {
      method: 'GET',
      baseUrl: '',
      headers: {
        accept: 'application/json',
      },
    });

    expect(logger.stdout).toEqual([['pollingEvent', ['info', 'first']]]);
  });

  it('throews when fetch returns unexpected status code', async () => {
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
        { logger, client }
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

    expect(logger.stdout).toEqual([]);
  });

  it('throews when fetch returns unexpected body', async () => {
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
        { logger, client }
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

    expect(logger.stdout).toEqual([]);
  });
});
