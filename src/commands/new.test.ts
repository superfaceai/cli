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
  const userError = createUserError(false, false);
  const ux = UX.create();

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running new command', () => {
    const originalWriteOnce = OutputStream.writeOnce;

    let mockWriteOnce: jest.Mock;
    let instance: New;

    beforeAll(() => {
      // Mock static side of OutputStream
      mockWriteOnce = jest.fn();
      OutputStream.writeOnce = mockWriteOnce;
    });

    beforeEach(() => {
      instance = CommandInstance(New);
    });

    afterAll(() => {
      // Restore static side of OutputStream
      OutputStream.writeOnce = originalWriteOnce;
    });

    describe('checking arguments', () => {
      it('throws when provider is not provided', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson));
        await expect(
          instance.execute({
            userError,
            flags: { timeout: 123 },
            args: { prompt },
          })
        ).rejects.toThrow(
          'Missing provider name or prompt. Usage: `superface new PROVIDERNAME [PROMPT]`'
        );
      });

      it('throws when prompt is not provided', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson));
        await expect(
          instance.execute({
            userError,
            flags: { timeout: 123 },
            args: { providerName },
          })
        ).rejects.toThrow(
          'Missing provider name or prompt. Usage: `superface new PROVIDERNAME [PROMPT]`'
        );
      });
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
        userError,
        flags: { timeout: 123 },
        args: { providerName, prompt },
      });

      expect(newProfile).toHaveBeenCalledWith(
        {
          providerJson,
          prompt,
          options: { quiet: undefined, timeout: 123 },
        },
        { ux, userError }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(
          `superface/${profileSope}.${profileName}.profile`
        ),
        profileSource
      );
    });

    it('throws when custom profile id is not valid', async () => {
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest.mocked(readFile).mockResolvedValueOnce(JSON.stringify(providerJson));
      jest.mocked(newProfile).mockResolvedValueOnce({
        source: profileSource,
        name: 'custom-name',
        scope: 'custom-scope',
      });

      await expect(
        instance.execute({
          userError,
          flags: { timeout: 123 },
          args: { providerName, prompt, profileId: 'n0tV4l!d' },
        })
      ).rejects.toThrow(
        'Invalid profile id: "n0tV4l!d" is not a valid lowercase identifier'
      );
    });

    it('prepares profile with custom id', async () => {
      jest.mocked(exists).mockResolvedValueOnce(true);
      jest.mocked(readFile).mockResolvedValueOnce(JSON.stringify(providerJson));
      jest.mocked(newProfile).mockResolvedValueOnce({
        source: profileSource,
        name: 'custom-name',
        scope: 'custom-scope',
      });

      await instance.execute({
        userError,
        flags: { timeout: 123 },
        args: { providerName, prompt, profileId: 'custom-scope/custom-name' },
      });

      expect(newProfile).toHaveBeenCalledWith(
        {
          providerJson,
          prompt,
          profileName: 'custom-name',
          profileScope: 'custom-scope',
          options: { quiet: undefined, timeout: 123 },
        },
        { ux, userError }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(`superface/custom-scope.custom-name.profile`),
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
        userError,
        flags: { timeout: 123 },
        args: { providerName, prompt },
      });

      expect(newProfile).toHaveBeenCalledWith(
        {
          providerJson,
          prompt,
          options: { quiet: undefined, timeout: 123 },
        },
        { ux, userError }
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
        userError,
        flags: { timeout: 123 },
        args: { providerName, prompt },
      });

      expect(newProfile).toHaveBeenCalledWith(
        {
          providerJson,
          prompt,
          options: { quiet: undefined, timeout: 123 },
        },
        { ux, userError }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(`superface/${profileName}.profile`),
        profileSource
      );
    });
  });
});
