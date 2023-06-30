import { MockLogger } from '../common';
import { createUserError } from '../common/error';
import { exists, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { UX } from '../common/ux';
import { newProfile } from '../logic/new';
import { mockProviderJson } from '../test/provider-json';
import { CommandInstance } from '../test/utils';
import New from './new';

jest.mock('../common/io');
jest.mock('../common/output-stream');
jest.mock('../logic/new');

describe('new CLI command', () => {
  const profileSource = 'profile';
  const providerName = 'test';
  const profileName = 'test';
  const profileSope = 'test-scope';
  const providerJson = mockProviderJson({ name: providerName });
  const prompt = 'test';
  const userError = createUserError(false);
  const ux = UX.create();

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running new command', () => {
    const originalWriteOnce = OutputStream.writeOnce;

    let mockWriteOnce: jest.Mock;
    let instance: New;
    let logger: MockLogger;

    beforeAll(() => {
      // Mock static side of OutputStream
      mockWriteOnce = jest.fn();
      OutputStream.writeOnce = mockWriteOnce;
    });

    beforeEach(() => {
      instance = CommandInstance(New);
      logger = new MockLogger();
    });

    afterAll(() => {
      // Restore static side of OutputStream
      OutputStream.writeOnce = originalWriteOnce;
    });

    it('throws when provider name is not provided', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { prompt: 'test' },
        })
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
          args: { providerName: '!_0%L', prompt: 'test' },
        })
      ).rejects.toThrow('Invalid provider name');
    });

    it('throws when prompt is not provided', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName: 'test' },
        })
      ).rejects.toThrow(
        'Missing short description of your use case in natural language. Please provide it as second argument.'
      );
    });

    it('throws when provider file does not exist', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName: 'test', prompt: 'test' },
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
          args: { providerName: 'test', prompt: 'test' },
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
          args: { providerName: 'test', prompt: 'test' },
        })
      ).rejects.toThrow(``);
    });

    it('throws when provider is not Provider JSON', async () => {
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest.mocked(readFile).mockResolvedValueOnce('{"test": 1}');
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName: 'test', prompt: 'test' },
        })
      ).rejects.toThrow(``);
    });

    it('throws when provider names does not match', async () => {
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(
          JSON.stringify(mockProviderJson({ name: 'test2' }))
        );
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName: 'test', prompt: 'test' },
        })
      ).rejects.toThrow(``);
    });

    it('throws when profile already exists', async () => {
      const providerName = 'test';
      const profileName = 'test';
      const profileSope = 'test-scope';
      const providerJson = mockProviderJson({ name: providerName });
      const prompt = 'test';
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest.mocked(readFile).mockResolvedValueOnce(JSON.stringify(providerJson));
      jest.mocked(newProfile).mockResolvedValueOnce({
        source: 'profile',
        name: profileName,
        scope: profileSope,
      });

      await instance.execute({
        logger,
        userError,
        flags: {},
        args: { providerName, prompt },
      });

      expect(newProfile).toHaveBeenCalledWith(
        {
          providerJson,
          prompt,
          options: { quiet: undefined },
        },
        { logger, ux, userError }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(
          `superface/${profileSope}.${profileName}.profile`
        ),
        profileSource
      );
    });

    it('prepares profile with scope', async () => {
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest.mocked(readFile).mockResolvedValueOnce(JSON.stringify(providerJson));
      jest.mocked(newProfile).mockResolvedValueOnce({
        source: profileSource,
        name: profileName,
        scope: profileSope,
      });

      await instance.execute({
        logger,
        userError,
        flags: {},
        args: { providerName, prompt },
      });

      expect(newProfile).toHaveBeenCalledWith(
        {
          providerJson,
          prompt,
          options: { quiet: undefined },
        },
        { logger, ux, userError }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(
          `superface/${profileSope}.${profileName}.profile`
        ),
        profileSource
      );
    });

    it('prepares profile without scope', async () => {
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest.mocked(readFile).mockResolvedValueOnce(JSON.stringify(providerJson));
      jest
        .mocked(newProfile)
        .mockResolvedValueOnce({ source: 'profile', name: profileName });

      await instance.execute({
        logger,
        userError,
        flags: {},
        args: { providerName, prompt },
      });

      expect(newProfile).toHaveBeenCalledWith(
        {
          providerJson,
          prompt,
          options: { quiet: undefined },
        },
        { logger, ux, userError }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(`superface/${profileName}.profile`),
        profileSource
      );
    });
  });
});
