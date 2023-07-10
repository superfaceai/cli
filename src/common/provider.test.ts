import type { ProviderJson } from '@superfaceai/ast';
import type { ServiceClient } from '@superfaceai/service-client';

import { mockResponse } from '../test/utils';
import { createUserError, stringifyError } from './error';
import { buildProviderPath } from './file-structure';
import { exists, readFile } from './io';
import { OutputStream } from './output-stream';
import { resolveProviderJson } from './provider';

jest.mock('./io');
jest.mock('../common/output-stream');

const mockFetch = jest.fn();

describe('resolveProviderJson', () => {
  const originalWriteOnce = OutputStream.writeOnce;

  let mockWriteOnce: jest.Mock;
  const userError = createUserError(false);

  let providerJson: ProviderJson;

  const client = { fetch: mockFetch } as unknown as jest.Mocked<ServiceClient>;

  beforeAll(() => {
    // Mock static side of OutputStream
    mockWriteOnce = jest.fn();
    OutputStream.writeOnce = mockWriteOnce;
  });

  beforeEach(() => {
    providerJson = {
      name: 'test',
      services: [
        {
          id: 'test',
          baseUrl: 'https://test.com',
        },
      ],
      defaultService: 'test',
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    // Restore static side of OutputStream
    OutputStream.writeOnce = originalWriteOnce;
  });

  it('should throw error when provider name is missing', async () => {
    await expect(
      resolveProviderJson(undefined, {
        userError,
        client,
      })
    ).rejects.toThrowError(
      'Missing provider name. Please provide it as first argument.'
    );
  });

  it('should throw error when provider name is invalid', async () => {
    await expect(
      resolveProviderJson('test!', {
        userError,
        client,
      })
    ).rejects.toThrowError('Invalid provider name');
  });

  it('should throw error when provider name does not match', async () => {
    jest.mocked(exists).mockResolvedValue(true);
    jest.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        ...providerJson,
        name: 'other-test',
      })
    );

    await expect(
      resolveProviderJson('test', {
        userError,
        client,
      })
    ).rejects.toThrowError(
      'Provider name in provider.json file does not match provider name in command.'
    );
  });

  describe('when provider json is remote', () => {
    it('should return provider json', async () => {
      jest.mocked(exists).mockResolvedValue(false);
      mockFetch.mockResolvedValue(
        mockResponse(200, 'ok', undefined, { definition: providerJson })
      );

      const result = await resolveProviderJson('test', {
        userError,
        client,
      });

      expect(result).toEqual({
        providerJson,
        source: 'remote',
      });
    });

    it('should throw error when provider json does not exist', async () => {
      jest.mocked(exists).mockResolvedValue(false);
      mockFetch.mockResolvedValue(mockResponse(404, 'not found'));

      await expect(
        resolveProviderJson('test', {
          userError,
          client,
        })
      ).rejects.toThrowError(
        `Provider test does not exist both locally (checked ${buildProviderPath('test')}) and remotely. Make sure to run "sf prepare" before running this command.`
      );
    });

    it('should throw error when server returns unexpected data', async () => {
      jest.mocked(exists).mockResolvedValue(false);
      mockFetch.mockResolvedValue(
        mockResponse(200, 'ok', undefined, { test: 'test' })
      );

      await expect(
        resolveProviderJson('test', {
          userError,
          client,
        })
      ).rejects.toThrowError('Invalid provider.json - invalid JSON');
    });

    it('should throw error when provider json is invalid JSON', async () => {
      jest.mocked(exists).mockResolvedValue(false);
      mockFetch.mockResolvedValue(mockResponse(200, 'ok', undefined));

      await expect(
        resolveProviderJson('test', {
          userError,
          client,
        })
      ).rejects.toThrowError('Invalid provider.json - invalid JSON');
    });

    it('should throw error when provider json is invalid', async () => {
      jest.mocked(exists).mockResolvedValue(false);
      mockFetch.mockResolvedValue(
        mockResponse(200, 'ok', undefined, { definition: { test: 'test' } })
      );

      await expect(
        resolveProviderJson('test', {
          userError,
          client,
        })
      ).rejects.toThrowError(
        'Invalid provider.json. $: must have required property "defaultService"'
      );
    });

    it('should throw error when server returns 500', async () => {
      const errorResponse = mockResponse(500, 'error', undefined, {
        message: 'test',
      });
      jest.mocked(exists).mockResolvedValue(false);
      mockFetch.mockResolvedValue(errorResponse);

      await expect(
        resolveProviderJson('test', {
          userError,
          client,
        })
      ).rejects.toThrowError(
        userError(
          `Failed to fetch provider.json file from Superface API. ${stringifyError(
            errorResponse
          )}`,
          1
        )
      );
    });

    it('should throw error when fetching fails', async () => {
      const error = new Error('test');
      jest.mocked(exists).mockResolvedValue(false);
      mockFetch.mockRejectedValue(error);

      await expect(
        resolveProviderJson('test', {
          userError,
          client,
        })
      ).rejects.toThrowError(
        userError(
          `Failed to fetch provider.json file from Superface API. ${stringifyError(
            error
          )}`,
          1
        )
      );
    });
  });

  describe('when provider json is local', () => {
    it('should return provider json', async () => {
      jest.mocked(exists).mockResolvedValue(true);
      jest.mocked(readFile).mockResolvedValue(JSON.stringify(providerJson));

      const result = await resolveProviderJson('test', {
        userError,
        client,
      });

      expect(result).toEqual({
        providerJson,
        source: 'local',
        path: expect.stringContaining('/superface/test.provider.json'),
      });
    });

    it('should throw error when provider json is not valid JSON', async () => {
      jest.mocked(exists).mockResolvedValue(true);
      jest.mocked(readFile).mockResolvedValue('invalid');

      await expect(
        resolveProviderJson('test', {
          userError,
          client,
        })
      ).rejects.toThrowError('Invalid provider.json file - invalid JSON');
    });

    it('should throw error when provider json is invalid', async () => {
      jest.mocked(exists).mockResolvedValue(true);
      jest.mocked(readFile).mockResolvedValue(JSON.stringify({ test: 'test' }));

      await expect(
        resolveProviderJson('test', {
          userError,
          client,
        })
      ).rejects.toThrowError(
        'Invalid provider.json file. $: must have required property "defaultService"'
      );
    });
  });
});
