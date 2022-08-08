import { EXTENSIONS } from '@superfaceai/ast';
import { err, ok, SDKExecutionError } from '@superfaceai/one-sdk';
import * as SuperJson from '@superfaceai/one-sdk/dist/schema-tools/superjson/utils';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import {
  DEFAULT_PROFILE_VERSION_STR,
  MockLogger,
  UNVERIFIED_PROVIDER_PREFIX,
} from '../common';
import { createUserError } from '../common/error';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import {
  reconfigureProfileProvider,
  reconfigureProvider,
} from '../logic/configure';
import { detectSuperJson } from '../logic/install';
import { publish } from '../logic/publish';
import { CommandInstance } from '../test/utils';
import Install from './install';
import Publish from './publish';

//Mock configure logic
jest.mock('../logic/configure', () => ({
  reconfigureProvider: jest.fn(),
  reconfigureProfileProvider: jest.fn(),
}));

//Mock publish logic
jest.mock('../logic/publish', () => ({
  publish: jest.fn(),
}));

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

describe('Publish CLI command', () => {
  let logger: MockLogger;
  let instance: Publish;

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(async () => {
    logger = new MockLogger();
    instance = CommandInstance(Publish);
  });

  describe('running publish command', () => {
    const profileId = 'starwars/character-information';
    const providerName = `${UNVERIFIED_PROVIDER_PREFIX}swapi`;

    const mockProfilePath = `../path/to/profile${EXTENSIONS.profile.source}`;
    const mockMapPath = `../path/to/profile${EXTENSIONS.map.source}`;
    const mockProviderPath = '../path/to/profile.json';

    const userError = createUserError(false);

    it('exits when user declines prompt', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: false });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: mockProfilePath,
            providers: {
              [providerName]: {
                file: 'some/path/to/map.suma',
              },
            },
          },
        },
        providers: {
          [providerName]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['map'],
          flags: {
            profileId,
            providerName,
            scan: 3,
          },
        })
      ).rejects.toThrow('EEXIT: 0');
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).toHaveBeenCalledTimes(1);
    }, 10000);

    it('throws error on invalid profile id', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['map'],
          flags: {
            profileId: 'U!0_',
            providerName,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        'Invalid profile id: "U!0_" is not a valid lowercase identifier'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid provider name', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['profile'],
          flags: {
            profileId,
            providerName: 'U!0_',
            scan: 3,
          },
        })
      ).rejects.toThrow('Invalid provider name: "U!0_"');
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws when super.json not found', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['profile'],
          flags: {
            profileId,
            providerName,
          },
        })
      ).rejects.toThrow('Unable to publish, super.json not found');
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('throws when super.json not loaded correctly', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(err(new SDKExecutionError('test', [], [])));
      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['profile'],
          flags: {
            profileId,
            providerName,
          },
        })
      ).rejects.toThrow('Unable to load super.json: test');
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('throws error on scan flag higher than 5', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['profile'],
          flags: {
            profileId,
            providerName,
            scan: 6,
          },
        })
      ).rejects.toThrow(
        '--scan/-s : Number of levels to scan cannot be higher than 5'
      );
      expect(promptSpy).not.toHaveBeenCalled();
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error when profile Id not found in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['profile'],
          flags: {
            profileId,
            providerName,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Unable to publish, profile: "${profileId}" not found in super.json`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error when profile path has wrong extension', async () => {
      const mockPath = 'some/path/to/file.json';
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: mockPath,
            providers: {
              [providerName]: {},
            },
          },
        },
        providers: {
          [providerName]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['profile'],
          flags: {
            profileId,
            providerName,
          },
        })
      ).rejects.toThrow(
        `Profile path: "${mockPath}" must leads to "${EXTENSIONS.profile.source}" file`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error when profile provider not found in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: '',
          },
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['profile'],
          flags: {
            profileId,
            providerName,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Unable to publish, provider: "${providerName}" not found in profile: "${profileId}" in super.json`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error when map path has wrong extension', async () => {
      const mockPath = 'some/path/to/file.ts';
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [providerName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [providerName]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['map'],
          flags: {
            profileId,
            providerName,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Map path: "${mockPath}" must leads to "${EXTENSIONS.map.source}" file`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error when provider not found in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: '',
            providers: {
              [providerName]: {},
            },
          },
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['provider'],
          flags: {
            profileId,
            providerName,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Unable to publish, provider: "${providerName}" not found in super.json`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('throws error when provider path has wrong extension', async () => {
      const mockPath = 'some/path/to/file.ts';

      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [providerName]: {},
            },
          },
        },
        providers: {
          [providerName]: {
            file: mockPath,
          },
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['provider'],
          flags: {
            profileId,
            providerName,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Provider path: "${mockPath}" must leads to ".json" file`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('throws error when publishing profile and profile not locally linked in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [providerName]: {},
            },
          },
        },
        providers: {
          [providerName]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['profile'],
          flags: {
            profileId,
            providerName,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        'When publishing profile, profile must be locally linked in super.json'
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('throws error when publishing map and map not locally linked in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [providerName]: {},
            },
          },
        },
        providers: {
          [providerName]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['map'],
          flags: {
            profileId,
            providerName,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        'When publishing map, map must be locally linked in super.json'
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('throws error when publishing provider and provider has not unverified prefix', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              test: {},
            },
          },
        },
        providers: {
          test: {
            file: 'path/to/provider.json',
          },
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['provider'],
          flags: {
            profileId,
            providerName: 'test',
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `When publishing provider, provider must have prefix "${UNVERIFIED_PROVIDER_PREFIX}"`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('throws error when publishing provider and provider not locally linked in super.json', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [providerName]: {},
            },
          },
        },
        providers: {
          [providerName]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['provider'],
          flags: {
            profileId,
            providerName,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        'When publishing provider, provider must be locally linked in super.json'
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('calls publish correctly when publishing profile', async () => {
      const installSpy = jest
        .spyOn(Install, 'run')
        .mockResolvedValue(undefined);
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true })
        .mockResolvedValue({ continue: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: mockProfilePath,
            providers: {
              [providerName]: {},
            },
          },
        },
        providers: {
          [providerName]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['profile'],
          flags: {
            profileId,
            providerName,
            scan: 3,
            dryRun: false,
            quiet: false,
          },
        })
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(2);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        {
          publishing: 'profile',
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
          profile: ProfileId.fromId(profileId, { userError }),
          provider: providerName,
          map: {
            variant: undefined,
          },
          version: undefined,
          options: {
            dryRun: false,
            quiet: false,
            emoji: true,
            json: undefined,
          },
        },
        expect.anything()
      );
      expect(installSpy).toHaveBeenCalledWith([profileId, '-f']);
      expect(writeOnceSpy).not.toHaveBeenCalled();
    });

    it('calls publish correctly when publishing map', async () => {
      mocked(reconfigureProfileProvider).mockResolvedValue(undefined);
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true })
        .mockResolvedValue({ continue: true });

      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [providerName]: {
                file: mockMapPath,
              },
            },
          },
        },
        providers: {
          [providerName]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['map'],
          flags: {
            profileId,
            providerName,
            scan: 3,
            dryRun: false,
            quiet: false,
          },
        })
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(2);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        {
          publishing: 'map',
          superJsonPath: 'super.json',
          superJson: mockSuperJson,
          profile: ProfileId.fromId(profileId, { userError }),
          provider: providerName,
          map: {
            variant: undefined,
          },
          version: DEFAULT_PROFILE_VERSION_STR,
          options: {
            dryRun: false,
            quiet: false,
            emoji: true,
            json: undefined,
          },
        },
        expect.anything()
      );
      expect(reconfigureProfileProvider).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(profileId, { userError }),
        providerName,
        { kind: 'remote' }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'super.json',
        expect.any(String),
        { force: undefined }
      );
    });

    it('calls publish correctly when publishing provider', async () => {
      mocked(reconfigureProvider).mockResolvedValue(undefined);
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true })
        .mockResolvedValue({ continue: true });

      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [providerName]: {},
            },
          },
        },
        providers: {
          [providerName]: {
            file: mockProviderPath,
          },
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['provider'],
          flags: {
            profileId,
            providerName,
            scan: 3,
          },
        })
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(2);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        {
          publishing: 'provider',
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
          profile: ProfileId.fromId(profileId, { userError }),
          provider: providerName,
          map: {
            variant: undefined,
          },
          version: DEFAULT_PROFILE_VERSION_STR,
          options: {
            dryRun: undefined,
            emoji: true,
            json: undefined,
            quiet: undefined,
          },
        },
        expect.anything()
      );
      expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 3);
      expect(reconfigureProvider).toHaveBeenCalledWith(
        mockSuperJson,
        providerName,
        { kind: 'remote' }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'super.json',
        expect.any(String),
        { force: undefined }
      );
    });

    it('calls publish correctly when publishing map with force flag', async () => {
      const promptSpy = jest.spyOn(inquirer, 'prompt');
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [providerName]: {
                file: mockMapPath,
              },
            },
          },
        },
        providers: {
          [providerName]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['map'],
          flags: {
            profileId,
            providerName,
            force: true,
          },
        })
      ).resolves.toBeUndefined();

      expect(promptSpy).not.toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        {
          publishing: 'map',
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
          profile: ProfileId.fromId(profileId, { userError }),
          provider: providerName,
          map: { variant: undefined },
          version: DEFAULT_PROFILE_VERSION_STR,
          options: {
            dryRun: undefined,
            emoji: true,
            json: undefined,
            quiet: undefined,
          },
        },
        expect.anything()
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'super.json',
        expect.any(String),
        { force: true }
      );
    });

    it('calls publish correctly when publishing map with locally linked provider', async () => {
      mocked(reconfigureProfileProvider).mockResolvedValue(undefined);
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true })
        .mockResolvedValueOnce({ continue: true });
      const mockPath = '../path/to/provider';
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [providerName]: {
                file: mockMapPath,
              },
            },
          },
        },
        providers: {
          [providerName]: {
            file: mockPath,
          },
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['map'],
          flags: {
            profileId,
            providerName,
          },
        })
      ).resolves.toBeUndefined();

      expect(promptSpy).not.toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        {
          publishing: 'map',
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
          profile: ProfileId.fromId(profileId, { userError }),
          provider: providerName,
          map: { variant: undefined },
          version: DEFAULT_PROFILE_VERSION_STR,
          options: {
            dryRun: undefined,
            emoji: true,
            json: undefined,
            quiet: undefined,
          },
        },
        expect.anything()
      );
      expect(reconfigureProfileProvider).toHaveBeenCalledWith(
        mockSuperJson,
        ProfileId.fromId(profileId, { userError }),
        providerName,
        { kind: 'remote' }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'super.json',
        expect.any(String),
        { force: undefined }
      );
    });

    it('calls publish correctly when publishing provider with --dry-run flag', async () => {
      mocked(reconfigureProvider).mockResolvedValue(undefined);
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true })
        .mockResolvedValueOnce({ continue: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [providerName]: {},
            },
          },
        },
        providers: {
          [providerName]: {
            file: mockProviderPath,
          },
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['provider'],
          flags: {
            profileId,
            providerName,
            scan: 3,
            dryRun: true,
          },
        })
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(2);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        {
          publishing: 'provider',
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
          profile: ProfileId.fromId(profileId, { userError }),
          provider: providerName,
          map: {
            variant: undefined,
          },
          version: DEFAULT_PROFILE_VERSION_STR,
          options: {
            dryRun: true,
            emoji: true,
            json: undefined,
            quiet: undefined,
          },
        },
        expect.anything()
      );

      expect(reconfigureProvider).toHaveBeenCalledWith(
        mockSuperJson,
        providerName,
        { kind: 'remote' }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'super.json',
        expect.any(String),
        { force: undefined }
      );
    });

    it('calls publish correctly when publishing provider with locally linked map', async () => {
      mocked(reconfigureProvider).mockResolvedValue(undefined);
      const mockPath = '../path/to/map';
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true })
        .mockResolvedValueOnce({ continue: true });
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
            providers: {
              [providerName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [providerName]: {
            file: mockProviderPath,
          },
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['provider'],
          flags: {
            profileId,
            providerName,
            scan: 3,
          },
        })
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(2);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        {
          publishing: 'provider',
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
          profile: ProfileId.fromId(profileId, { userError }),
          provider: providerName,
          map: {
            variant: undefined,
          },
          version: DEFAULT_PROFILE_VERSION_STR,
          options: {
            emoji: true,
            json: undefined,
            quiet: undefined,
            dryRun: undefined,
          },
        },
        expect.anything()
      );

      expect(reconfigureProvider).toHaveBeenCalledWith(
        mockSuperJson,
        providerName,
        { kind: 'remote' }
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'super.json',
        expect.any(String),
        { force: undefined }
      );
    });

    it('calls publish correctly when publishing profile with --quiet flag', async () => {
      const installSpy = jest
        .spyOn(Install, 'run')
        .mockResolvedValue(undefined);

      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true })
        .mockResolvedValueOnce({ continue: true });

      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: mockProfilePath,
            providers: {
              [providerName]: {},
            },
          },
        },
        providers: {
          [providerName]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['profile'],
          flags: {
            profileId,
            providerName,
            quiet: true,
          },
        })
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(2);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        {
          publishing: 'profile',
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
          profile: ProfileId.fromId(profileId, { userError }),
          provider: providerName,
          map: {
            variant: undefined,
          },
          version: undefined,
          options: {
            quiet: true,
            dryRun: undefined,
            emoji: true,
            json: undefined,
          },
        },
        expect.anything()
      );
      expect(installSpy).toHaveBeenCalledWith([profileId, '-f']);
      expect(writeOnceSpy).not.toHaveBeenCalled();
    });

    it('prints report when publish returns report', async () => {
      const mockReportStr = 'mock report';
      const installSpy = jest.spyOn(Install, 'run');

      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });

      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: mockProfilePath,
            providers: {
              [providerName]: {},
            },
          },
        },
        providers: {
          [providerName]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(publish).mockResolvedValue(mockReportStr);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        instance.execute({
          logger,
          userError,
          argv: ['profile'],
          flags: {
            profileId,
            providerName,
            quiet: true,
          },
        })
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        {
          publishing: 'profile',
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
          profile: ProfileId.fromId(profileId, { userError }),
          provider: providerName,
          map: {
            variant: undefined,
          },
          version: undefined,
          options: {
            quiet: true,
            emoji: true,
            json: undefined,
            dryRun: undefined,
          },
        },
        expect.anything()
      );
      expect(installSpy).not.toHaveBeenCalled();
      expect(writeOnceSpy).not.toHaveBeenCalled();
    });
  });
});
