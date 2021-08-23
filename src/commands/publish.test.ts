import { CLIError } from '@oclif/errors';
import { err, ok, SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import { DEFAULT_PROFILE_VERSION_STR, EXTENSIONS } from '../common';
import { ProfileId } from '../common/profile';
import { detectSuperJson } from '../logic/install';
import { publish } from '../logic/publish';
import Publish from './publish';

//Mock publish logic
jest.mock('../logic/publish', () => ({
  publish: jest.fn(),
}));

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

describe('Publish CLI command', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running publish command', () => {
    const profileId = 'starwars/character-information';
    const provider = 'swapi';

    const mockProfilePath = `../path/to/profile${EXTENSIONS.profile.source}`;
    const mockMapPath = `../path/to/profile${EXTENSIONS.map.source}`;
    const mockProviderPath = `../path/to/profile${EXTENSIONS.provider}`;

    it('exits when user declines prompt', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: false });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        Publish.run([
          'map',
          '--profileId',
          'U!0_',
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(new CLIError('EEXIT: 0'));
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
      expect(promptSpy).toHaveBeenCalledTimes(1);
    }, 10000);

    it('throws error on invalid profile id', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        Publish.run([
          'map',
          '--profileId',
          'U!0_',
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(
        new CLIError(
          'Invalid profile id: "U!0_" is not a valid lowercase identifier'
        )
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
      expect(promptSpy).toHaveBeenCalledTimes(1);
    }, 10000);

    it('throws error on invalid provider name', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        Publish.run([
          'profile',
          '--profileId',
          profileId,
          '--providerName',
          'U!0_',
          '-s',
          '3',
        ])
      ).rejects.toEqual(new CLIError('Invalid provider name: "U!0_"'));
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
      expect(promptSpy).toHaveBeenCalled();
    }, 10000);

    it('throws when super.json not found', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(
        Publish.run([
          'profile',
          '--profileId',
          profileId,
          '--providerName',
          provider,
        ])
      ).rejects.toEqual(
        new CLIError('Unable to publish, super.json not found')
      );
      expect(promptSpy).toHaveBeenCalled();
    });

    it('throws when super.json not loaded correctly', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      jest.spyOn(SuperJson, 'load').mockResolvedValue(err('test error'));
      await expect(
        Publish.run([
          'map',
          '--profileId',
          profileId,
          '--providerName',
          provider,
        ])
      ).rejects.toEqual(new CLIError('Unable to load super.json: test error'));
      expect(promptSpy).toHaveBeenCalled();
    });

    it('throws error on invalid scan flag', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        Publish.run([
          'map',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s test',
        ])
      ).rejects.toEqual(
        new CLIError('Expected an integer but received:  test')
      );
      expect(promptSpy).not.toHaveBeenCalled();
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on scan flag higher than 5', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        Publish.run([
          'profile',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '6',
        ])
      ).rejects.toEqual(
        new CLIError(
          '--scan/-s : Number of levels to scan cannot be higher than 5'
        )
      );
      expect(promptSpy).toHaveBeenCalled();
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error when profile Id not found in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        Publish.run([
          'profile',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(
        new CLIError(
          `Unable to publish, profile: "${profileId}" not found in super.json`
        )
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error when profile provider not found in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: '',
          },
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        Publish.run([
          'map',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(
        new CLIError(
          `Unable to publish, provider: "${provider}" not found in profile: "${profileId}" in super.json`
        )
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error when provider not found in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: '',
            providers: {
              [provider]: {},
            },
          },
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        Publish.run([
          'provider',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(
        new CLIError(
          `Unable to publish, provider: "${provider}" not found in super.json`
        )
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).toHaveBeenCalled();
    });

    it('throws error when publishing profile and profile not locally linked in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        Publish.run([
          'profile',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(
        new CLIError(
          `When publishing profile, profile must be locally linked in super.json`
        )
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).toHaveBeenCalled();
    });

    it('throws error when publishing map and map not locally linked in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        Publish.run([
          'map',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(
        new CLIError(
          `When publishing map, map must be locally linked in super.json`
        )
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).toHaveBeenCalled();
    });

    it('throws error when publishing provider and provider not locally linked in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        Publish.run([
          'provider',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(
        new CLIError(
          `When publishing provider, provider must be locally linked in super.json`
        )
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).toHaveBeenCalled();
    });

    it('calls publish correctly when publishing profile', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: mockProfilePath,
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);

      await expect(
        Publish.run([
          'profile',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        'profile',
        mockSuperJson,
        ProfileId.fromId(profileId),
        provider,
        {
          variant: undefined,
        },
        DEFAULT_PROFILE_VERSION_STR,
        {
          logCb: expect.anything(),
          dryRun: false,
          quiet: false,
        }
      );
    });

    it('calls publish correctly when publishing map', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [provider]: {
                file: mockMapPath,
              },
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);

      await expect(
        Publish.run([
          'map',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        'map',
        mockSuperJson,
        ProfileId.fromId(profileId),
        provider,
        {
          variant: undefined,
        },
        DEFAULT_PROFILE_VERSION_STR,
        {
          logCb: expect.anything(),
          dryRun: false,
          quiet: false,
        }
      );
    });

    it('calls publish correctly when publishing provider', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {
            file: mockProviderPath,
          },
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);

      await expect(
        Publish.run([
          'provider',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        'provider',
        mockSuperJson,
        ProfileId.fromId(profileId),
        provider,
        {
          variant: undefined,
        },
        DEFAULT_PROFILE_VERSION_STR,
        {
          logCb: expect.anything(),
          dryRun: false,
          quiet: false,
        }
      );
      expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 3);
    });

    it('calls publish correctly when publishing map with force flag', async () => {
      const promptSpy = jest.spyOn(inquirer, 'prompt');
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [provider]: {
                file: mockMapPath,
              },
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);

      await expect(
        Publish.run([
          'map',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-f',
        ])
      ).resolves.toBeUndefined();

      expect(promptSpy).not.toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        'map',
        mockSuperJson,
        ProfileId.fromId(profileId),
        provider,
        { variant: undefined },
        DEFAULT_PROFILE_VERSION_STR,
        {
          logCb: expect.anything(),
          dryRun: false,
          quiet: false,
        }
      );
    });

    it('calls publish correctly when publishing provider with --dry-run flag', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {
            file: mockProviderPath,
          },
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);

      await expect(
        Publish.run([
          'provider',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '--dry-run',
        ])
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        'provider',
        mockSuperJson,
        ProfileId.fromId(profileId),
        provider,
        {
          variant: undefined,
        },
        DEFAULT_PROFILE_VERSION_STR,
        {
          logCb: expect.anything(),
          dryRun: true,
          quiet: false,
        }
      );
    });

    it('calls publish correctly when publishing profile with --quiet flag', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: mockProfilePath,
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);

      await expect(
        Publish.run([
          'profile',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-q',
        ])
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        'profile',
        mockSuperJson,
        ProfileId.fromId(profileId),
        provider,
        {
          variant: undefined,
        },
        DEFAULT_PROFILE_VERSION_STR,
        {
          logCb: undefined,
          dryRun: false,
          quiet: true,
        }
      );
    });
  });
});
