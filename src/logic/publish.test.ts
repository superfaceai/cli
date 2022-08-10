import {
  AstMetadata,
  MapDocumentNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { ServiceApiError } from '@superfaceai/service-client';
import { ServiceClient } from '@superfaceai/service-client/dist/client';
import { mocked } from 'ts-jest/utils';

import {
  DEFAULT_PROFILE_VERSION_STR,
  MockLogger,
  UNVERIFIED_PROVIDER_PREFIX,
} from '../common';
import { createUserError } from '../common/error';
import { fetchProviderInfo, getServicesUrl } from '../common/http';
import { loadNetrc } from '../common/netrc';
import { ProfileId } from '../common/profile';
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

jest.mock('../common/netrc');
jest.mock('@superfaceai/service-client/dist/client');
jest.mock('../common/http', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/http'),
  fetchProviderInfo: jest.fn(),
  getServicesUrl: jest.fn(),
}));
jest.mock('./check.utils', () => ({
  loadProvider: jest.fn(),
}));
jest.mock('./publish.utils', () => ({
  loadMap: jest.fn(),
  loadProfile: jest.fn(),
  loadProvider: jest.fn(),
  prePublishCheck: jest.fn(),
  prePublishLint: jest.fn(),
}));

describe('Publish logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);

  describe('when publishing', () => {
    const mockProfileId = 'starwars/character-information';
    const mockProviderName = 'swapi';
    const mockVersion = '1.0.0';

    const astMetadata: AstMetadata = {
      sourceChecksum: 'check',
      astVersion: {
        major: 1,
        minor: 0,
        patch: 0,
      },
      parserVersion: {
        major: 1,
        minor: 0,
        patch: 0,
      },
    };

    const mockProfileDocument: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      astMetadata,
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
      astMetadata,
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

    const checkResults: CheckResult[] = [
      {
        kind: 'profileMap',
        profileFrom: mockLocalProfileFrom,
        mapFrom: mockLocalMapFrom,
        profileId: mockProfileId,
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
        profileId: mockProfileId,
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
            path: {
              kind: '',
            },
            expected: 'this',
            actual: 'that',
          },
        },
      ],
      warnings: [
        {
          kind: 'wrongScope',
          context: {
            path: {
              kind: '',
            },
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

    beforeEach(() => {
      logger = new MockLogger();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('publishes profile', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      };
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
        publish(
          {
            publishing: 'profile',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockProfileSource, {
        dryRun: undefined,
      });
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: undefined,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: undefined,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'profile',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockLocalProfileFrom,
          mapFrom: mockLocalMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes profile with map variant', async () => {
      const variant = 'test';
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
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
      };
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
        publish(
          {
            publishing: 'profile',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: { variant },
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockProfileSource, {
        dryRun: undefined,
      });
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: undefined,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: { variant },
          version: undefined,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'profile',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockLocalProfileFrom,
          mapFrom: mockRemoteMapFrom,
          providerFrom: mockRemoteProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes profile with remote provider', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      };
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
        publish(
          {
            publishing: 'profile',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockProfileSource, {
        dryRun: undefined,
      });
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: undefined,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: undefined,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'profile',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockLocalProfileFrom,
          mapFrom: mockLocalMapFrom,
          providerFrom: mockRemoteProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('calls create profile with dry-run', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      };
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
        publish(
          {
            publishing: 'profile',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
            version: undefined,
            options: { dryRun: true },
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockProfileSource, {
        dryRun: true,
      });
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: undefined,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: undefined,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'profile',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockLocalProfileFrom,
          mapFrom: mockLocalMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishing profile and profile not found locally', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            file: mockPath,
            providers: {
              [mockProviderName]: {},
            },
          },
        },
        providers: {
          [mockProviderName]: {},
        },
      };

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });

      await expect(
        publish(
          {
            publishing: 'profile',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
            version: undefined,
            options: { dryRun: true },
          },
          { logger, userError }
        )
      ).rejects.toThrow(
        `Profile: "${mockProfileId}" not found on local file system`
      );

      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: undefined,
        },
        expect.anything()
      );
    });

    it('publishes map', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };
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
        publish(
          {
            publishing: 'map',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockMapSource, {
        dryRun: undefined,
      });
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: undefined,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: undefined,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'map',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockLocalMapFrom,
          providerFrom: mockRemoteProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );

      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes map with profile version', async () => {
      const version = '1.0.6';
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
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
      };
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
        publish(
          {
            publishing: 'map',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
            version,
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockMapSource, {
        dryRun: undefined,
      });
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'map',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockLocalProfileFrom,
          mapFrom: mockLocalMapFrom,
          providerFrom: mockRemoteProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes map with remote provider', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };
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
        publish(
          {
            publishing: 'map',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
            version: DEFAULT_PROFILE_VERSION_STR,
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockMapSource, {
        dryRun: undefined,
      });
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'map',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockLocalMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('calls create map with dry-run', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };
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
        publish(
          {
            publishing: 'map',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
            version: DEFAULT_PROFILE_VERSION_STR,
            options: { dryRun: true },
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(mockMapSource, { dryRun: true });
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'map',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockLocalMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishin map and provider without unverified prefix does not exist in superface store', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };
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

      await expect(
        publish(
          {
            publishing: 'map',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
            version: DEFAULT_PROFILE_VERSION_STR,
          },
          { userError, logger }
        )
      ).rejects.toThrow(
        `Provider: ${mockMapDocument.header.provider} does not exist in Superface store and it does not start with: ${UNVERIFIED_PROVIDER_PREFIX} prefix.\nPlease, rename provider: ${mockMapDocument.header.provider} or use existing provider.`
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(fetchProviderInfo).toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'map',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockLocalMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );

      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishing map and map not found locally', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };

      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });

      await expect(
        publish(
          {
            publishing: 'map',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
            version: DEFAULT_PROFILE_VERSION_STR,
            options: { dryRun: true },
          },
          { logger, userError }
        )
      ).rejects.toThrow(
        `Map for profile: "${mockProfileId}" and provider: "${mockProviderName}" not found on local filesystem`
      );

      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
    });

    it('publishes provider', async () => {
      const provider = 'unverified-swapi';
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
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };
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
        publish(
          {
            publishing: 'provider',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider,
            map: {},
            version: DEFAULT_PROFILE_VERSION_STR,
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(
        JSON.stringify(mockProviderSource),
        { dryRun: undefined }
      );
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider,
          map: {},
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(mockSuperJson, '', provider, {
        logger,
      });
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'provider',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockLocalProfileFrom,
          mapFrom: mockRemoteMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('publishes provider with map varinat', async () => {
      const provider = 'unverified-swapi';
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
      const variant = 'test';
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };
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
        publish(
          {
            publishing: 'provider',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider,
            map: { variant },
            version: DEFAULT_PROFILE_VERSION_STR,
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(
        JSON.stringify(mockProviderSource),
        { dryRun: undefined }
      );
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider,
          map: { variant },
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(mockSuperJson, '', provider, {
        logger,
      });
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'provider',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockRemoteMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishing provider withou unverified prefix', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };
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
        publish(
          {
            publishing: 'provider',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
            version: DEFAULT_PROFILE_VERSION_STR,
            options: { dryRun: true },
          },
          { logger, userError }
        )
      ).rejects.toThrow(
        `When publishing provider, provider name: "${mockProviderName}" in provider.json must have prefix "${UNVERIFIED_PROVIDER_PREFIX}"`
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'provider',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockRemoteMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('calls create provider with --dry-run', async () => {
      const provider = 'unverified-swapi';
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
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };
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
        publish(
          {
            publishing: 'provider',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider,
            map: {},
            version: DEFAULT_PROFILE_VERSION_STR,
            options: { dryRun: true },
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(createSpy).toHaveBeenCalledWith(
        JSON.stringify(mockProviderSource),
        { dryRun: true }
      );
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider,
          map: {},
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(mockSuperJson, '', provider, {
        logger,
      });
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'provider',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockRemoteMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('throws when publishing provider and provider not found locally', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };

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
        publish(
          {
            publishing: 'provider',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
            version: DEFAULT_PROFILE_VERSION_STR,
            options: { dryRun: true },
          },
          { logger, userError }
        )
      ).rejects.toThrow(
        `Provider: "${mockProviderName}" not found on local file system`
      );

      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
    });

    it('does not publish when there are check errors', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };

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
      mocked(prePublishCheck).mockReturnValue(checkResults);
      mocked(prePublishLint).mockReturnValue(emptyLintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      const result = await publish(
        {
          publishing: 'provider',
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: DEFAULT_PROFILE_VERSION_STR,
          options: { dryRun: true },
        },
        { logger, userError }
      );

      expect(result).toMatch('Check results:');

      expect(result).toMatch(
        checkFormatHuman({ checkResults, color: false, emoji: false })
      );

      expect(result).toMatch('Lint results:');

      expect(result).toMatch(
        lintFormatHuman({
          report: emptyLintResult,
          emoji: false,
          color: false,
        })
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'provider',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockRemoteMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish when there are lint errors', async () => {
      const checkResults: CheckResult[] = [];
      const lintResult: ProfileMapReport = {
        path: mockPath,
        kind: 'compatibility',
        profile: 'test-profile',
        errors: [
          {
            kind: 'wrongScope',
            context: {
              path: {
                kind: '',
              },
              expected: 'this',
              actual: 'that',
            },
          },
        ],
        warnings: [
          {
            kind: 'wrongScope',
            context: {
              path: {
                kind: '',
              },
              expected: 'this',
              actual: 'that',
            },
          },
        ],
      };
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };

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
      mocked(prePublishCheck).mockReturnValue(checkResults);
      mocked(prePublishLint).mockReturnValue(lintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      const result = await publish(
        {
          publishing: 'provider',
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: DEFAULT_PROFILE_VERSION_STR,
          options: { dryRun: true },
        },
        { logger, userError }
      );
      expect(result).toMatch('Check results:');

      expect(result).toMatch(
        checkFormatHuman({ checkResults, emoji: false, color: false })
      );

      expect(result).toMatch('Lint results:');

      expect(result).toMatch(
        lintFormatHuman({
          report: lintResult,
          emoji: false,
          color: false,
        })
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'provider',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockRemoteMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });

    it('does not publish when there are lint and check errors and json flag', async () => {
      const mockSuperJson = {
        profiles: {
          [mockProfileId]: {
            version: DEFAULT_PROFILE_VERSION_STR,
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
      };

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
      mocked(prePublishCheck).mockReturnValue(checkResults);
      mocked(prePublishLint).mockReturnValue(lintResult);

      const createSpy = jest
        .spyOn(ServiceClient.prototype, 'createProvider')
        .mockResolvedValue(undefined);

      await expect(
        publish(
          {
            publishing: 'provider',
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: ProfileId.fromId(mockProfileId, { userError }),
            provider: mockProviderName,
            map: {},
            version: DEFAULT_PROFILE_VERSION_STR,
            options: { dryRun: true, json: true },
          },
          { logger, userError }
        )
      ).resolves.toEqual(
        JSON.stringify({
          check: {
            reports: checkFormatJson(checkResults),
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
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromId(mockProfileId, { userError }),
          provider: mockProviderName,
          map: {},
          version: DEFAULT_PROFILE_VERSION_STR,
        },
        expect.anything()
      );
      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        mockProviderName,
        expect.anything()
      );
      expect(fetchProviderInfo).not.toHaveBeenCalled();
      expect(prePublishCheck).toHaveBeenCalledWith(
        {
          publishing: 'provider',
          profileAst: mockProfileDocument,
          mapAst: mockMapDocument,
          providerJson: mockProviderSource,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockRemoteMapFrom,
          providerFrom: mockLocalProviderFrom,
          superJson: mockSuperJson,
          superJsonPath: '',
        },
        expect.anything()
      );
      expect(prePublishLint).toHaveBeenCalledWith(
        mockProfileDocument,
        mockMapDocument
      );
    });
  });
});
