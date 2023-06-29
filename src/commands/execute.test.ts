import { MockLogger } from '../common';
import { createUserError } from '../common/error';
import { exists, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { execute } from '../logic/execution';
import { mockProviderJson } from '../test/provider-json';
import { CommandInstance } from '../test/utils';
import Execute from './execute';

jest.mock('../common/io');
jest.mock('../common/output-stream');
jest.mock('../logic/execution');

describe('execute CLI command', () => {
  const providerName = 'provider-name';
  const profileName = 'test';
  const profileScope = 'test-scope';
  const providerJson = mockProviderJson({ name: providerName });
  const mockProfileSource = (
    scope: string | undefined,
    name: string
  ) => `name = "${scope !== undefined ? `${scope}/` : ''}${name}"
  version = "1.0.0"
  
  "Test"
  usecase Test safe {
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
  const userError = createUserError(false);

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running execute command', () => {
    const originalWriteOnce = OutputStream.writeOnce;

    let mockWriteOnce: jest.Mock;
    let instance: Execute;
    let logger: MockLogger;

    beforeAll(() => {
      // Mock static side of OutputStream
      mockWriteOnce = jest.fn();
      OutputStream.writeOnce = mockWriteOnce;
    });

    beforeEach(() => {
      instance = CommandInstance(Execute);
      logger = new MockLogger();
    });

    afterAll(() => {
      // Restore static side of OutputStream
      OutputStream.writeOnce = originalWriteOnce;
    });

    it('throws when provider name is not provided', async () => {
      await expect(
        instance.execute({ logger, userError, flags: {}, args: {} })
      ).rejects.toThrow(
        'Missing provider name. Please provide it as first argument.'
      );
    });

    it('throws when provider name is invalid', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName: '!_0%L' },
        })
      ).rejects.toThrow('Invalid provider name');
    });

    it('throws when provider file does not exist', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName: 'test', profileId: 'test' },
        })
      ).rejects.toThrow(
        'Provider test does not exist. Make sure to run "sf prepare" before running this command.'
      );
    });

    it('throws when reading of file fails', async () => {
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest.mocked(readFile).mockRejectedValueOnce(new Error('File read error'));
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName: 'test', profileId: 'test' },
        })
      ).rejects.toThrow('File read error');
    });

    it('throws when provider is not valid JSON', async () => {
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest.mocked(readFile).mockResolvedValueOnce('file content');
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName: 'test', profileId: 'test' },
        })
      ).rejects.toThrow(`Invalid provider.json file.`);
    });

    it('throws when provider is not Provider JSON', async () => {
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest.mocked(readFile).mockResolvedValueOnce('{"test": 1}');
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName: 'test', profileId: 'test' },
        })
      ).rejects.toThrow(`Invalid provider.json file.`);
    });

    it('throws when provider names does not match', async () => {
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(
          JSON.stringify(mockProviderJson({ name: 'test-api' }))
        );
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName, profileId: `${profileScope}.${profileName}` },
        })
      ).rejects.toThrow(
        `Provider name in provider.json file does not match provider name in command.`
      );
    });

    // TODO: Add tests for profile name validation

    it('throws when language is not valid', async () => {
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify(providerJson))
        .mockResolvedValueOnce(mockProfileSource(profileScope, profileName));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: {
            providerName,
            profileId: `${profileScope}.${profileName}`,
            language: 'Java',
          },
        })
      ).rejects.toThrow(
        `Language Java is not supported. Currently only JS is supported.`
      );
    });

    it('throws when map file does not exist', async () => {
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify(providerJson))
        .mockResolvedValueOnce(mockProfileSource(profileScope, profileName));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName, profileId: 'test' },
        })
      ).rejects.toThrow(``);
    });

    it('executes runfile - profile with scope', async () => {
      jest.mocked(exists).mockResolvedValue(true);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify(providerJson))
        .mockResolvedValueOnce(mockProfileSource(profileScope, profileName));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName, profileId: `${profileScope}.${profileName}` },
        })
      ).resolves.toBeUndefined();

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining(
          `${profileScope}.${profileName}.${providerName}.mjs`
        ),
        'JS',
        {
          logger,
          userError,
        }
      );
    });

    it('executes runfile - profile without scope', async () => {
      jest.mocked(exists).mockResolvedValue(true);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify(providerJson))
        .mockResolvedValueOnce(mockProfileSource(undefined, profileName));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName, profileId: profileName },
        })
      ).resolves.toBeUndefined();

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining(`${profileName}.${providerName}.mjs`),
        'JS',
        {
          logger,
          userError,
        }
      );
    });
  });
});
