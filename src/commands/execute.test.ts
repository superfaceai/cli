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

    describe('checking language argument', () => {
      it('throws when language is invalid', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: {
              providerName,
              profileId: profileName,
              language: 'Some other lang',
            },
          })
        ).rejects.toThrow(
          'Language Some other lang is not supported. Supported languages are: python, js'
        );
      });
    });

    describe('checking profile id argument', () => {
      it('throws when profile id is not provided', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName },
          })
        ).rejects.toThrow(
          'Missing profile id. Please provide it as first argument.'
        );
      });

      it('throws when profile id is invalid', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: '!_0%L' },
          })
        ).rejects.toThrow(
          'Invalid profile id: "!_0%L" is not a valid lowercase identifier'
        );
      });

      it('throws when profile file does not exist', async () => {
        jest
          .mocked(exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: '!_0%L' },
          })
        ).rejects.toThrow(
          'Invalid profile id: "!_0%L" is not a valid lowercase identifier'
        );
      });

      it('throws when reading of file fails', async () => {
        jest
          .mocked(exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockRejectedValueOnce(new Error('File read error'));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: profileName },
          })
        ).rejects.toThrow('File read error');
      });

      it('throws when profile source is not valid Comlink', async () => {
        jest
          .mocked(exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson))
          .mockResolvedValueOnce('something');
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: profileName },
          })
        ).rejects.toThrow(`Invalid profile ${profileName}: `);
      });

      it('throws when profile names does not match', async () => {
        jest
          .mocked(exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson))
          .mockResolvedValueOnce(mockProfileSource(undefined, 'other'));

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: profileName },
          })
        ).rejects.toThrow(
          'Profile name in profile file does not match profile name in command.'
        );
      });

      it('throws when profile scopes does not match', async () => {
        jest
          .mocked(exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson))
          .mockResolvedValueOnce(mockProfileSource('other', profileName));

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: profileName },
          })
        ).rejects.toThrow(
          'Profile scope in profile file does not match profile scope in command.'
        );
      });
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
        'js',
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
        'js',
        {
          logger,
          userError,
        }
      );
    });
  });
});
