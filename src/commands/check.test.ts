import {
  err,
  normalizeSuperJsonDocument,
  ok,
  SDKExecutionError,
} from '@superfaceai/one-sdk';
import * as SuperJson from '@superfaceai/one-sdk/dist/schema-tools/superjson/utils';
import { mocked } from 'ts-jest/utils';

import { createUserError } from '../common/error';
import { MockLogger } from '../common/log';
import { ProfileId } from '../common/profile';
import type { CheckResult } from '../logic/check';
import { check, formatHuman, formatJson } from '../logic/check';
import { detectSuperJson } from '../logic/install';
import type {
  MapFromMetadata,
  ProfileFromMetadata,
  ProviderFromMetadata,
} from '../logic/publish.utils';
import type { MockStd } from '../test/mock-std';
import { mockStd } from '../test/mock-std';
import { CommandInstance } from '../test/utils';
import Check from './check';

jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));
jest.mock('../logic/check', () => ({
  check: jest.fn(),
  formatHuman: jest.fn(),
  formatJson: jest.fn(),
}));

describe('Check CLI command', () => {
  let instance: Check;
  let logger: MockLogger;
  let stderr: MockStd;
  let stdout: MockStd;

  const userError = createUserError(false);

  const profileId = 'starwars/character-information';
  const provider = 'swapi';
  const version = '1.0.3';
  const mockMapSource = 'mock map source';

  const mockLocalMapFrom: MapFromMetadata = {
    kind: 'local',
    source: mockMapSource,
    path: 'mock map path',
  };

  const mockLocalProviderFrom: ProviderFromMetadata = {
    kind: 'local',
    path: 'mock provider path',
  };

  const mockRemoteProfileFrom: ProfileFromMetadata = {
    kind: 'remote',
    version,
  };

  const mockRemoteMapFrom: MapFromMetadata = {
    kind: 'remote',
    version,
  };

  const mockResult: CheckResult[] = [
    {
      kind: 'profileMap',
      provider,
      profileFrom: mockRemoteProfileFrom,
      mapFrom: mockRemoteMapFrom,
      profileId,
      issues: [
        {
          kind: 'error',
          message: 'first-error',
        },
        {
          kind: 'warn',
          message: 'first-warn',
        },
        {
          kind: 'error',
          message: 'second-error',
        },
        {
          kind: 'warn',
          message: 'second-warn',
        },
      ],
    },
    {
      kind: 'mapProvider',
      provider,
      providerFrom: mockLocalProviderFrom,
      mapFrom: mockLocalMapFrom,
      profileId,
      issues: [
        {
          kind: 'error',
          message: 'first-error',
        },
        {
          kind: 'warn',
          message: 'first-warn',
        },
        {
          kind: 'error',
          message: 'second-error',
        },
        {
          kind: 'warn',
          message: 'second-warn',
        },
      ],
    },
  ];

  beforeEach(() => {
    logger = new MockLogger();
    instance = CommandInstance(Check);
    stdout = mockStd();
    stderr = mockStd();

    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
    jest
      .spyOn(process['stderr'], 'write')
      .mockImplementation(stderr.implementation);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running checkcommand', () => {
    it('throws when super.json not found', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(
        instance.execute({
          logger,
          userError,
          flags: { profileId, providerName: provider },
        })
      ).rejects.toThrow('Unable to check, super.json not found');
    });

    it('throws when super.json not loaded correctly', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(err(new SDKExecutionError('test error', [], [])));
      await expect(
        instance.execute({
          logger,
          userError,
          flags: { profileId, providerName: provider },
        })
      ).rejects.toThrow('Unable to load super.json: test error');
    });

    it('throws error on scan flag higher than 5', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
            providerName: provider,
            scan: 6,
          },
        })
      ).rejects.toThrow(
        '--scan/-s : Number of levels to scan cannot be higher than 5'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid profile id', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: 'U!0_',
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        'Invalid profile id: "U!0_" is not a valid lowercase identifier'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid provider name', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
            providerName: 'U!0_',
            scan: 3,
          },
        })
      ).rejects.toThrow('Invalid provider name: "U!0_"');
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on missing profile id when providerName is provided', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        '--profileId must be specified when using --providerName'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error when profile Id not found in super.json', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Unable to check, profile: "${profileId}" not found in super.json`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error when profile provider not found in super.json', async () => {
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
          flags: {
            profileId,
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Unable to check, provider: "${provider}" not found in profile: "${profileId}" in super.json`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error when provider not found in super.json', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: '',
            providers: {
              [provider]: {},
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
          flags: {
            profileId,
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Unable to check, provider: "${provider}" not found in super.json`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    });

    it('formats result to human readable format', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(check).mockResolvedValue(mockResult);
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: '',
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(formatHuman).mockReturnValue('format-human');

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toThrow('Command found 4 errors and 4 warnings');
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(check).toHaveBeenCalledWith(
        mockSuperJson,
        'super.json',
        [
          {
            id: ProfileId.fromScopeName('starwars', 'character-information'),
            maps: [
              {
                provider: provider,
                variant: undefined,
              },
            ],
            version: undefined,
          },
        ],
        expect.anything()
      );
      expect(stdout.output).toEqual('format-human\n');
      expect(formatHuman).toHaveBeenCalledWith({
        checkResults: mockResult,
        emoji: true,
        color: true,
      });
    });

    it('formats result to human readable format with quiet flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(check).mockResolvedValue(mockResult);
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: '',
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(formatHuman).mockReturnValue('format-human');

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toThrow('Command found 4 errors and 4 warnings');

      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(check).toHaveBeenCalledWith(
        mockSuperJson,
        'super.json',
        [
          {
            id: ProfileId.fromScopeName('starwars', 'character-information'),
            maps: [
              {
                provider,
                variant: undefined,
              },
            ],
            version: undefined,
          },
        ],
        expect.anything()
      );
      expect(stdout.output).toEqual('format-human\n');
      expect(formatHuman).toHaveBeenCalledWith({
        checkResults: mockResult,
        color: true,
        emoji: true,
      });
    });

    it('formats result to json with quiet flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(check).mockResolvedValue(mockResult);
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: '',
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(formatJson).mockReturnValue(
        '[{"kind": "error", "message": "test"}]'
      );

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
            providerName: provider,
            scan: 3,
            quiet: true,
            json: true,
          },
        })
      ).rejects.toThrow('Command found 4 errors and 4 warnings');
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(check).toHaveBeenCalledWith(
        mockSuperJson,
        'super.json',
        [
          {
            id: ProfileId.fromScopeName('starwars', 'character-information'),
            maps: [
              {
                provider,
                variant: undefined,
              },
            ],
            version: undefined,
          },
        ],
        expect.anything()
      );
      expect(stdout.output).toContain('[{"kind": "error", "message": "test"}]');
      expect(formatJson).toHaveBeenCalledWith(mockResult);
      expect(formatHuman).not.toHaveBeenCalled();
    });
  });

  describe('when preparing profiles to validation', () => {
    const localProfile = 'local/profile';
    const remoteProfile = 'remote/profile';
    const localProvider = 'local-provider';
    const remoteProvider = 'remote-provider';
    const remoteProviderWithVarinat = 'remote-provider-with-variant';
    const variant = 'variant';
    const mockSuperJson = normalizeSuperJsonDocument({
      profiles: {
        [localProfile]: {
          file: 'profileFile',
          providers: {
            [localProvider]: {
              file: 'mapPath',
            },
            [remoteProvider]: {},
            [remoteProviderWithVarinat]: {
              mapVariant: variant,
            },
          },
        },
        [remoteProfile]: {
          version: '1.0.0',
          providers: {
            [localProvider]: {
              file: 'mapPath',
            },
            [remoteProvider]: {},
            [remoteProviderWithVarinat]: {
              mapVariant: variant,
            },
          },
        },
      },
      providers: {
        [localProvider]: {},
        [remoteProviderWithVarinat]: {},
        [remoteProvider]: {},
      },
    });

    it('prepares every local capability in super.json', async () => {
      expect(
        Check.prepareProfilesToValidate(
          { superJson: mockSuperJson },
          { userError }
        )
      ).toEqual([
        {
          id: ProfileId.fromId(localProfile, { userError }),
          maps: [
            {
              provider: localProvider,
            },
          ],
        },
      ]);
    });

    it('prepares specific profile id in super.json', async () => {
      expect(
        Check.prepareProfilesToValidate(
          { superJson: mockSuperJson, profileId: localProfile },
          { userError }
        )
      ).toEqual([
        {
          id: ProfileId.fromId(localProfile, { userError }),
          maps: [
            {
              provider: localProvider,
            },
            {
              provider: remoteProvider,
            },
            {
              provider: remoteProviderWithVarinat,
              variant,
            },
          ],
        },
      ]);

      expect(
        Check.prepareProfilesToValidate(
          { superJson: mockSuperJson, profileId: remoteProfile },
          { userError }
        )
      ).toEqual([
        {
          id: ProfileId.fromId(remoteProfile, { userError }),
          maps: [
            {
              provider: localProvider,
            },
            {
              provider: remoteProvider,
            },
            {
              provider: remoteProviderWithVarinat,
              variant,
            },
          ],
          version: '1.0.0',
        },
      ]);
    });

    it('prepares specific profile and map in super.json', async () => {
      expect(
        Check.prepareProfilesToValidate(
          {
            superJson: mockSuperJson,
            profileId: localProfile,
            providerName: localProvider,
          },
          { userError }
        )
      ).toEqual([
        {
          id: ProfileId.fromId(localProfile, { userError }),
          maps: [
            {
              provider: localProvider,
            },
          ],
        },
      ]);

      expect(
        Check.prepareProfilesToValidate(
          {
            superJson: mockSuperJson,
            profileId: remoteProfile,
            providerName: localProvider,
          },
          { userError }
        )
      ).toEqual([
        {
          id: ProfileId.fromId(remoteProfile, { userError }),
          maps: [
            {
              provider: localProvider,
            },
          ],
          version: '1.0.0',
        },
      ]);
      expect(
        Check.prepareProfilesToValidate(
          {
            superJson: mockSuperJson,
            profileId: localProfile,
            providerName: remoteProvider,
          },
          { userError }
        )
      ).toEqual([
        {
          id: ProfileId.fromId(localProfile, { userError }),
          maps: [
            {
              provider: remoteProvider,
            },
          ],
        },
      ]);

      expect(
        Check.prepareProfilesToValidate(
          {
            superJson: mockSuperJson,
            profileId: remoteProfile,
            providerName: remoteProvider,
          },
          { userError }
        )
      ).toEqual([
        {
          id: ProfileId.fromId(remoteProfile, { userError }),
          maps: [
            {
              provider: remoteProvider,
            },
          ],
          version: '1.0.0',
        },
      ]);

      expect(
        Check.prepareProfilesToValidate(
          {
            superJson: mockSuperJson,
            profileId: localProfile,
            providerName: remoteProviderWithVarinat,
          },
          { userError }
        )
      ).toEqual([
        {
          id: ProfileId.fromId(localProfile, { userError }),
          maps: [
            {
              provider: remoteProviderWithVarinat,
              variant,
            },
          ],
        },
      ]);

      expect(
        Check.prepareProfilesToValidate(
          {
            superJson: mockSuperJson,
            profileId: remoteProfile,
            providerName: remoteProviderWithVarinat,
          },
          { userError }
        )
      ).toEqual([
        {
          id: ProfileId.fromId(remoteProfile, { userError }),
          maps: [
            {
              provider: remoteProviderWithVarinat,
              variant,
            },
          ],
          version: '1.0.0',
        },
      ]);
    });
  });
});
