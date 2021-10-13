import { CLIError } from '@oclif/errors';
import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import {
  DEFAULT_MAP_VERSION,
  DEFAULT_PROFILE_VERSION,
  MapId,
  MapVersion,
  ProfileId,
  ProfileVersion,
} from '@superfaceai/parser';
import { ServiceApiError, ServiceClient } from '@superfaceai/service-client';
import { yellow } from 'chalk';
import { mocked } from 'ts-jest/utils';

import { UNVERIFIED_PROVIDER_PREFIX } from '../common';
import { fetchProviderInfo, getServicesUrl } from '../common/http';
import { loadNetrc } from '../common/netrc';
import { ProfileMapReport } from '../common/report.interfaces';
import {
  CheckResult,
  formatHuman as checkFormatHuman,
  formatJson as checkFormatJson,
} from './check';
import {
  formatHuman as lintFormatHuman,
  formatJson as lintFormatJson,
} from './lint';
import { publish } from './publish';
import {
  loadMap,
  loadProfile,
  loadProvider,
  MapFromMetadata,
  prePublishCheck,
  prePublishLint,
  ProfileFromMetadata,
  ProviderFromMetadata,
} from './publish.utils';

//Mock netrc
jest.mock('../common/netrc');

//Mock only service client
jest.mock('@superfaceai/service-client/dist/client');

//Mock http
jest.mock('../common/http', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/http'),
  fetchProviderInfo: jest.fn(),
  getServicesUrl: jest.fn(),
}));

//Mock check utils
jest.mock('./check.utils', () => ({
  loadProvider: jest.fn(),
}));

//Mock publish utils
jest.mock('./publish.utils', () => ({
  loadMap: jest.fn(),
  loadProfile: jest.fn(),
  loadProvider: jest.fn(),
  prePublishCheck: jest.fn(),
  prePublishLint: jest.fn(),
}));

describe('Publish logic', () => {
  describe('when publishing', () => {
    const scope = 'starwars';
    const name = 'character-information';

    const mockProviderName = 'swapi';
    const mockVersion = '1.0.0';

    const profile = ProfileId.fromParameters({
      scope,
      name,
      version: DEFAULT_PROFILE_VERSION,
    });

    const map = MapId.fromParameters({
      profile,
      provider: mockProviderName,
      version: DEFAULT_MAP_VERSION,
    });

    const mockProfileDocument: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      header: {
        kind: 'ProfileHeader',
        name: 'test-profile',
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      },
      definitions: [],
    };
    const mockPath = '/test/path.supr';
    const mockProfileSource = 'profile content';
    const mockMapSource = 'map content';

    const mockMapDocument: MapDocumentNode = {
      kind: 'MapDocument',
      header: {
        kind: 'MapHeader',
        profile: {
          name: 'different-test-profile',
          scope: 'some-map-scope',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        provider: 'test-profile',
      },
      definitions: [],
    };

    const mockProviderSource = {
      name: 'swapi',
      services: [
        {
          id: 'default',
          baseUrl: 'https://swapi.dev/api',
        },
      ],
      defaultService: 'default',
    };

    const mockLocalProfileFrom: ProfileFromMetadata = {
      kind: 'local',
      source: mockProfileSource,
      path: 'mock profile path',
    };

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
      version: mockVersion,
    };

    const mockRemoteMapFrom: MapFromMetadata = {
      kind: 'remote',
      version: mockVersion,
    };

    const mockRemoteProviderFrom: ProviderFromMetadata = {
      kind: 'remote',
    };

    const checkResult: CheckResult[] = [
      {
        kind: 'profileMap',
        profileFrom: mockLocalProfileFrom,
        mapFrom: mockLocalMapFrom,
        profileId: profile.toString(),
        provider: mockProviderName,
        issues: [
          {
            kind: 'error',
            message: 'first-error',
          },
          {
            kind: 'warn',
            message: 'first-warn',
          },
        ],
      },
      {
        kind: 'mapProvider',
        mapFrom: mockLocalMapFrom,
        providerFrom: mockLocalProviderFrom,
        profileId: profile.toString(),
        provider: mockProviderName,
        issues: [
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

    const lintResult: ProfileMapReport = {
      path: mockPath,
      kind: 'compatibility',
      profile: 'test-profile',
      errors: [
        {
          kind: 'wrongScope',
          context: {
            expected: 'this',
            actual: 'that',
          },
        },
      ],
      warnings: [
        {
          kind: 'wrongScope',
          context: {
            expected: 'this',
            actual: 'that',
          },
        },
      ],
    };

    const emptyLintResult: ProfileMapReport = {
      kind: 'compatibility',
      profile: '',
      path: '',
      errors: [],
      warnings: [],
    };

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('publishes profile', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(getServicesUrl).mockReturnValue('');
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockLocalProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockLocalMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProfile')
        .mockResolvedValue(undefined);

      await expect(
        publish('profile', mockSuperJson, profile, map, {})
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockProfileSource);
      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {});
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, {});
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        undefined
      );
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'profile',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockLocalProfileFrom,
        mapFrom: mockLocalMapFrom,
        providerFrom: mockLocalProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes profile with map variant', async () => {
      const variant = 'test';
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
        variant,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {
                mapVariant: variant,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockLocalProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockRemoteProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProfile')
        .mockResolvedValue(undefined);

      await expect(
        publish('profile', mockSuperJson, profile, map)
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockProfileSource);
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        profile,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, undefined);
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        undefined
      );
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'profile',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockLocalProfileFrom,
        mapFrom: mockRemoteMapFrom,
        providerFrom: mockRemoteProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes profile with remote provider', async () => {
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockLocalProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockLocalMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockRemoteProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProfile')
        .mockResolvedValue(undefined);

      await expect(
        publish('profile', mockSuperJson, profile, map, {})
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockProfileSource);
      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {});
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, {});
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        undefined
      );
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'profile',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockLocalProfileFrom,
        mapFrom: mockLocalMapFrom,
        providerFrom: mockRemoteProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish profile with --dry-run', async () => {
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockLocalProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockLocalMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProfile')
        .mockResolvedValue(undefined);

      await expect(
        publish('profile', mockSuperJson, profile, map, { dryRun: true })
      ).resolves.toBeUndefined();

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {
        dryRun: true,
      });
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, {
        dryRun: true,
      });
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        { dryRun: true }
      );
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'profile',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockLocalProfileFrom,
        mapFrom: mockLocalMapFrom,
        providerFrom: mockLocalProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishing profile and profile not found locally', async () => {
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });

      await expect(
        publish('profile', mockSuperJson, profile, map, { dryRun: true })
      ).rejects.toEqual(
        new CLIError(
          `Profile: "${profile.toString()}" not found on local file system`
        )
      );

      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {
        dryRun: true,
      });
    });

    it('publishes map', async () => {
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [mockProviderName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockLocalMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockRemoteProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createMap')
        .mockResolvedValue(undefined);

      await expect(
        publish('map', mockSuperJson, profile, map, {})
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockMapSource);
      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {});
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, {});
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        undefined
      );
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'map',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockRemoteProfileFrom,
        mapFrom: mockLocalMapFrom,
        providerFrom: mockRemoteProviderFrom,
      });

      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes map with profile version', async () => {
      const version = '1.0.6';
      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: ProfileVersion.fromString(version),
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: MapVersion.fromString('1.0'),
        provider: mockProviderName,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: version,
            providers: {
              [mockProviderName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockLocalProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockLocalMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockRemoteProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createMap')
        .mockResolvedValue(undefined);

      await expect(
        publish('map', mockSuperJson, profile, map)
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockMapSource);
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        profile,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, undefined);
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        undefined
      );
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'map',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockLocalProfileFrom,
        mapFrom: mockLocalMapFrom,
        providerFrom: mockRemoteProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes map with remote provider', async () => {
      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_PROFILE_VERSION,
        provider: mockProviderName,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [mockProviderName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockLocalMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createMap')
        .mockResolvedValue(undefined);

      await expect(
        publish('map', mockSuperJson, profile, map, {})
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockMapSource);
      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {});
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, {});
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        undefined
      );
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'map',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockRemoteProfileFrom,
        mapFrom: mockLocalMapFrom,
        providerFrom: mockLocalProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish map with --dry-run', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [mockProviderName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockLocalMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createMap')
        .mockResolvedValue(undefined);

      await expect(
        publish('map', mockSuperJson, profile, map, { dryRun: true })
      ).resolves.toBeUndefined();

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {
        dryRun: true,
      });
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, {
        dryRun: true,
      });
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        { dryRun: true }
      );
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'map',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockRemoteProfileFrom,
        mapFrom: mockLocalMapFrom,
        providerFrom: mockLocalProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishin map and provider without unverified prefix does not exist in superface store', async () => {
      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [mockProviderName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockLocalMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(fetchProviderInfo).mockRejectedValue(
        new ServiceApiError({
          status: 404,
          instance: 'test',
          detail: 'test',
          title: 'test',
        })
      );
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createMap')
        .mockResolvedValue(undefined);

      await expect(publish('map', mockSuperJson, profile, map)).rejects.toEqual(
        new CLIError(
          `Provider: "${mockMapDocument.header.provider}" does not exist in Superface store and it does not start with: "${UNVERIFIED_PROVIDER_PREFIX}" prefix.\nPlease, rename provider: "${mockMapDocument.header.provider}" or use existing provider.`
        )
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        profile,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, undefined);
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        undefined
      );
      expect(fetchProviderInfo).toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'map',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockRemoteProfileFrom,
        mapFrom: mockLocalMapFrom,
        providerFrom: mockLocalProviderFrom,
      });

      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishing map and map not found locally', async () => {
      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [mockProviderName]: {
                file: mockPath,
              },
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      });

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });

      await expect(
        publish('map', mockSuperJson, profile, map, { dryRun: true })
      ).rejects.toEqual(
        new CLIError(
          `Map: "starwars/character-information.swapi@1.0" not found on local filesystem`
        )
      );

      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {
        dryRun: true,
      });
    });

    it('publishes provider', async () => {
      const provider = 'unverified-swapi';
      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider,
      });
      const mockProviderSource = {
        name: provider,
        services: [
          {
            id: 'default',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        defaultService: 'default',
      };
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {
            file: mockPath,
          },
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockLocalProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish('provider', mockSuperJson, profile, map)
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(
        JSON.stringify(mockProviderSource)
      );
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        profile,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, undefined);
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        provider,
        undefined
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'provider',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockLocalProfileFrom,
        mapFrom: mockRemoteMapFrom,
        providerFrom: mockLocalProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes provider with map varinat', async () => {
      const provider = 'unverified-swapi';
      const variant = 'test';

      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider,
        variant,
      });
      const mockProviderSource = {
        name: provider,
        services: [
          {
            id: 'default',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        defaultService: 'default',
      };
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [provider]: {
                mapVariant: variant,
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: mockPath,
          },
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish('provider', mockSuperJson, profile, map)
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(
        JSON.stringify(mockProviderSource)
      );
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        profile,
        undefined
      );
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, undefined);
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        provider,
        undefined
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'provider',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockRemoteProfileFrom,
        mapFrom: mockRemoteMapFrom,
        providerFrom: mockLocalProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishing provider withou unverified prefix', async () => {
      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish('provider', mockSuperJson, profile, map, { dryRun: true })
      ).rejects.toEqual(
        new CLIError(
          `❌ When publishing provider, provider name: "${mockProviderName}" in provider.json must have prefix "${UNVERIFIED_PROVIDER_PREFIX}"`
        )
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {
        dryRun: true,
      });
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, {
        dryRun: true,
      });
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        { dryRun: true }
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'provider',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockRemoteProfileFrom,
        mapFrom: mockRemoteMapFrom,
        providerFrom: mockLocalProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish provider with --dry-run', async () => {
      const provider = 'unverified-swapi';
      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider,
      });
      const mockProviderSource = {
        name: provider,
        services: [
          {
            id: 'default',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        defaultService: 'default',
      };
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {
            file: mockPath,
          },
        },
      });
      mocked(loadNetrc).mockReturnValue({
        refreshToken: 'RT',
        baseUrl: 'https://superface.ai',
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish('provider', mockSuperJson, profile, map, { dryRun: true })
      ).resolves.toBeUndefined();

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {
        dryRun: true,
      });
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, {
        dryRun: true,
      });
      expect(loadProvider).toHaveBeenCalledWith(mockSuperJson, provider);
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'provider',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockRemoteProfileFrom,
        mapFrom: mockRemoteMapFrom,
        providerFrom: mockLocalProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishing provider and provider not found locally', async () => {
      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockRemoteProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue([]);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      await expect(
        publish('provider', mockSuperJson, profile, map, { dryRun: true })
      ).rejects.toEqual(
        new CLIError(
          `Provider: "${mockProviderName}" not found on local file system`
        )
      );

      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {
        dryRun: true,
      });
    });

    it('does not publish when there are check errors', async () => {
      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
      });

      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue(checkResult);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish('provider', mockSuperJson, profile, map, { dryRun: true })
      ).resolves.toEqual(
        yellow('Check results:\n') +
          checkFormatHuman(checkResult) +
          yellow('\n\nLint results:\n') +
          lintFormatHuman(emptyLintResult, false)
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {
        dryRun: true,
      });
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, {
        dryRun: true,
      });
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        { dryRun: true }
      );
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'provider',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockRemoteProfileFrom,
        mapFrom: mockRemoteMapFrom,
        providerFrom: mockLocalProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish when there are lint errors', async () => {
      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
      });
      const checkResult: CheckResult[] = [];
      const lintResult: ProfileMapReport = {
        path: mockPath,
        kind: 'compatibility',
        profile: 'test-profile',
        errors: [
          {
            kind: 'wrongScope',
            context: {
              expected: 'this',
              actual: 'that',
            },
          },
        ],
        warnings: [
          {
            kind: 'wrongScope',
            context: {
              expected: 'this',
              actual: 'that',
            },
          },
        ],
      };
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue(checkResult);
      mocked(prePublishLint).mockReturnValue(lintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish('provider', mockSuperJson, profile, map, { dryRun: true })
      ).resolves.toEqual(
        yellow('Check results:\n') +
          checkFormatHuman(checkResult) +
          yellow('\n\nLint results:\n') +
          lintFormatHuman(lintResult, false)
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {
        dryRun: true,
      });
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, {
        dryRun: true,
      });
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        { dryRun: true }
      );
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'provider',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockRemoteProfileFrom,
        mapFrom: mockRemoteMapFrom,
        providerFrom: mockLocalProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish when there are lint and check errors and json flag', async () => {
      const profile = ProfileId.fromParameters({
        scope,
        name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const map = MapId.fromParameters({
        profile: profile,
        version: DEFAULT_MAP_VERSION,
        provider: mockProviderName,
      });
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.withoutVersion]: {
            version: DEFAULT_PROFILE_VERSION.toString(),
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {
            file: mockPath,
          },
        },
      });

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderSource,
        from: mockLocalProviderFrom,
      });
      mocked(prePublishCheck).mockReturnValue(checkResult);
      mocked(prePublishLint).mockReturnValue(lintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish('provider', mockSuperJson, profile, map, {
          dryRun: true,
          json: true,
        })
      ).resolves.toEqual(
        JSON.stringify({
          check: {
            reports: checkFormatJson(checkResult),
            total: {
              errors: 2,
              warnings: 2,
            },
          },
          lint: {
            reports: lintFormatJson(lintResult),
            total: {
              errors: 1,
              warnings: 1,
            },
          },
        })
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(mockSuperJson, profile, {
        dryRun: true,
        json: true,
      });
      expect(loadMap).toHaveBeenCalledWith(map, mockSuperJson, {
        dryRun: true,
        json: true,
      });
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        mockProviderName,
        { dryRun: true, json: true }
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith({
        publishing: 'provider',
        profileAst: mockProfileDocument,
        mapAst: mockMapDocument,
        providerJson: mockProviderSource,
        profileFrom: mockRemoteProfileFrom,
        mapFrom: mockRemoteMapFrom,
        providerFrom: mockLocalProviderFrom,
      });
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });
  });
});
