import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import {
  ApiKeyPlacement,
  HttpScheme,
  ProviderJson,
  SecurityType,
  SuperJson,
} from '@superfaceai/one-sdk';
import {
  DEFAULT_MAP_VERSION,
  DEFAULT_PROFILE_VERSION,
  MapId,
  MapVersion,
  ProfileId,
  ProfileVersion,
} from '@superfaceai/parser';
import { green, red, yellow } from 'chalk';
import { mocked } from 'ts-jest/utils';

import { UNVERIFIED_PROVIDER_PREFIX } from '../common';
import {
  fetchMapAST,
  fetchProfileAST,
  fetchProviderInfo,
} from '../common/http';
import {
  check,
  checkMapAndProfile,
  checkMapAndProvider,
  CheckResult,
  formatHuman,
  formatJson,
} from './check';
import { isProviderParseError } from './check.utils';
import {
  loadMap,
  loadProfile,
  loadProvider,
  MapFromMetadata,
  ProfileFromMetadata,
  ProviderFromMetadata,
} from './publish.utils';

//Mock publish utils
jest.mock('./publish.utils', () => ({
  loadMap: jest.fn(),
  loadProfile: jest.fn(),
  loadProvider: jest.fn(),
}));
//Mock check utils
jest.mock('./check.utils', () => ({
  findLocalProviderSource: jest.fn(),
  isProviderParseError: jest.fn(),
}));

//Mock http
jest.mock('../common/http', () => ({
  fetchProfileAST: jest.fn(),
  fetchMapAST: jest.fn(),
  fetchProviderInfo: jest.fn(),
}));

describe('Check logic', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  const profile = {
    name: 'character-information',
    scope: 'starwars',
    version: '1.0.3',
  };

  const provider = 'swapi';
  const unverifiedProvider = `${UNVERIFIED_PROVIDER_PREFIX}${provider}`;

  const variant = 'variant';
  const mockProfileSource = 'mock profile source';
  const mockMapSource = 'mock map source';

  const mockMapDocument: MapDocumentNode = {
    kind: 'MapDocument',
    header: {
      kind: 'MapHeader',
      profile: {
        name: 'character-information',
        scope: 'starwars',
        version: {
          major: 1,
          minor: 0,
          patch: 3,
        },
      },
      provider,
    },
    definitions: [
      {
        kind: 'MapDefinition',
        name: 'RetrieveCharacterInformation',
        usecaseName: 'RetrieveCharacterInformation',
        statements: [],
      },
    ],
  };

  const mockMapDocumentWithUnverified: MapDocumentNode = {
    kind: 'MapDocument',
    header: {
      kind: 'MapHeader',
      profile: {
        name: 'character-information',
        scope: 'starwars',
        version: {
          major: 1,
          minor: 0,
          patch: 3,
        },
      },
      provider: unverifiedProvider,
    },
    definitions: [
      {
        kind: 'MapDefinition',
        name: 'RetrieveCharacterInformation',
        usecaseName: 'RetrieveCharacterInformation',
        statements: [],
      },
    ],
  };

  const mockProfileDocument: ProfileDocumentNode = {
    kind: 'ProfileDocument',
    header: {
      kind: 'ProfileHeader',
      name: 'character-information',
      scope: 'starwars',
      version: {
        major: 1,
        minor: 0,
        patch: 3,
      },
    },
    definitions: [
      {
        kind: 'UseCaseDefinition',
        useCaseName: 'RetrieveCharacterInformation',
        safety: 'safe',
        input: {
          kind: 'UseCaseSlotDefinition',
        },
      },
    ],
  };
  const mockProviderJson: ProviderJson = {
    name: provider,
    services: [{ id: 'test-service', baseUrl: 'service/base/url' }],
    securitySchemes: [
      {
        type: SecurityType.HTTP,
        id: 'basic',
        scheme: HttpScheme.BASIC,
      },
      {
        id: 'api',
        type: SecurityType.APIKEY,
        in: ApiKeyPlacement.HEADER,
        name: 'Authorization',
      },
      {
        id: 'bearer',
        type: SecurityType.HTTP,
        scheme: HttpScheme.BEARER,
        bearerFormat: 'some',
      },
      {
        id: 'digest',
        type: SecurityType.HTTP,
        scheme: HttpScheme.DIGEST,
      },
    ],
    defaultService: 'test-service',
  };

  const mockUnverifiedProviderJson: ProviderJson = {
    name: unverifiedProvider,
    services: [{ id: 'test-service', baseUrl: 'service/base/url' }],
    securitySchemes: [
      {
        type: SecurityType.HTTP,
        id: 'basic',
        scheme: HttpScheme.BASIC,
      },
      {
        id: 'api',
        type: SecurityType.APIKEY,
        in: ApiKeyPlacement.HEADER,
        name: 'Authorization',
      },
      {
        id: 'bearer',
        type: SecurityType.HTTP,
        scheme: HttpScheme.BEARER,
        bearerFormat: 'some',
      },
      {
        id: 'digest',
        type: SecurityType.HTTP,
        scheme: HttpScheme.DIGEST,
      },
    ],
    defaultService: 'test-service',
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
    version: profile.version,
  };

  const mockRemoteMapFrom: MapFromMetadata = {
    kind: 'remote',
    version: profile.version,
  };

  const mockRemoteProviderFrom: ProviderFromMetadata = {
    kind: 'remote',
  };

  describe('when checking capability', () => {
    it('returns correctly formated string when we use local files', async () => {
      const mockProfile = {
        name: 'character-information',
      };
      const mockSuperJson = new SuperJson({
        profiles: {
          [profile.name]: {
            file: '',
            providers: {
              [unverifiedProvider]: {
                file: '',
              },
            },
          },
        },
        providers: {
          [unverifiedProvider]: {
            file: '',
          },
        },
      });
      mocked(loadMap).mockResolvedValue({
        from: mockLocalMapFrom,
        ast: mockMapDocumentWithUnverified,
      });
      mocked(loadProfile).mockResolvedValue({
        from: mockLocalProfileFrom,
        ast: mockProfileDocument,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockUnverifiedProviderJson,
        from: mockLocalProviderFrom,
      });

      const expectedProfileId = ProfileId.fromParameters({
        name: mockProfile.name,
        version: DEFAULT_PROFILE_VERSION,
      });
      const expectedMapId = MapId.fromParameters({
        profile: expectedProfileId,
        provider: unverifiedProvider,
        variant,
        version: DEFAULT_MAP_VERSION,
      });
      await expect(
        check(mockSuperJson, [
          {
            id: expectedProfileId,
            maps: [expectedMapId],
          },
        ])
      ).resolves.toEqual([
        {
          kind: 'profileMap',
          mapFrom: mockLocalMapFrom,
          profileFrom: mockLocalProfileFrom,
          issues: [],
          profileId: 'starwars/character-information@1.0.3',
          provider: unverifiedProvider,
        },
        {
          kind: 'mapProvider',
          mapFrom: mockLocalMapFrom,
          providerFrom: mockLocalProviderFrom,
          issues: [],
          profileId: 'starwars/character-information',
          provider: unverifiedProvider,
        },
      ]);

      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        unverifiedProvider,
        undefined
      );
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId
      );
      expect(loadMap).toHaveBeenCalledWith(mockSuperJson, expectedMapId);
      expect(fetchMapAST).not.toHaveBeenCalled();
      expect(fetchProfileAST).not.toHaveBeenCalled();
      expect(fetchProviderInfo).not.toHaveBeenCalled();
    });

    it('returns correctly formated string when we use remote files', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
            file: '',
            providers: {
              [unverifiedProvider]: {
                file: '',
              },
            },
          },
        },
        providers: {
          [unverifiedProvider]: {
            file: '',
          },
        },
      });
      const expectedProfileId = ProfileId.fromParameters({
        scope: profile.scope,
        name: profile.name,
        version: ProfileVersion.fromString(profile.version),
      });
      const expectedMapId = MapId.fromParameters({
        profile: expectedProfileId,
        provider: unverifiedProvider,
        variant,
        version: MapVersion.fromString('1.0'),
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocumentWithUnverified,
        from: mockRemoteMapFrom,
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockUnverifiedProviderJson,
        from: mockRemoteProviderFrom,
      });

      await expect(
        check(mockSuperJson, [
          {
            id: expectedProfileId,
            maps: [expectedMapId],
          },
        ])
      ).resolves.toEqual([
        {
          kind: 'profileMap',
          mapFrom: mockRemoteMapFrom,
          profileFrom: mockRemoteProfileFrom,
          issues: [],
          profileId: 'starwars/character-information@1.0.3',
          provider: unverifiedProvider,
        },
        {
          kind: 'mapProvider',
          mapFrom: mockRemoteMapFrom,
          providerFrom: mockRemoteProviderFrom,
          issues: [],
          profileId: 'starwars/character-information',
          provider: unverifiedProvider,
        },
      ]);

      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        unverifiedProvider,
        undefined
      );
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId
      );
      expect(loadMap).toHaveBeenCalledWith(mockSuperJson, expectedMapId);

      expect(fetchMapAST).toHaveBeenCalledWith(expectedMapId);
      expect(fetchProfileAST).toHaveBeenCalledWith(expectedProfileId);
      expect(fetchProviderInfo).toHaveBeenCalledWith(unverifiedProvider);
    });

    it('throws error on invalid map document', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
            file: '',
            providers: {
              [provider]: {
                file: '',
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: '',
          },
        },
      });
      const expectedProfileId = ProfileId.fromParameters({
        scope: profile.scope,
        name: profile.name,
        version: ProfileVersion.fromString(profile.version),
      });
      const expectedMapId = MapId.fromParameters({
        profile: expectedProfileId,
        provider: unverifiedProvider,
        variant,
        version: MapVersion.fromString('1.0'),
      });

      mocked(loadMap).mockResolvedValue({
        ast: {} as MapDocumentNode,
        from: mockRemoteMapFrom,
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderJson,
        from: mockRemoteProviderFrom,
      });

      await expect(
        check(mockSuperJson, [
          {
            id: expectedProfileId,
            maps: [expectedMapId],
          },
        ])
      ).rejects.toThrow();

      expect(loadProvider).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId
      );
      expect(loadMap).toHaveBeenCalledWith(mockSuperJson, expectedMapId);

      expect(fetchMapAST).toHaveBeenCalledWith(expectedMapId);
      expect(fetchProfileAST).toHaveBeenCalledWith(expectedProfileId);
      expect(fetchProviderInfo).not.toHaveBeenCalled();
    });

    it('throws error on invalid profile document', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
            file: '',
            providers: {
              [provider]: {
                file: '',
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: '',
          },
        },
      });
      const expectedProfileId = ProfileId.fromParameters({
        scope: profile.scope,
        name: profile.name,
        version: ProfileVersion.fromString(profile.version),
      });
      const expectedMapId = MapId.fromParameters({
        profile: expectedProfileId,
        provider: unverifiedProvider,
        variant,
        version: MapVersion.fromString('1.0'),
      });
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });
      mocked(loadProfile).mockResolvedValue({
        ast: {} as ProfileDocumentNode,
        from: mockRemoteProfileFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderJson,
        from: mockRemoteProviderFrom,
      });
      await expect(
        check(mockSuperJson, [
          {
            id: expectedProfileId,
            maps: [expectedMapId],
          },
        ])
      ).rejects.toThrow();

      expect(loadProvider).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId
      );
      expect(loadMap).not.toHaveBeenCalled();

      expect(fetchMapAST).not.toHaveBeenCalled();
      expect(fetchProfileAST).toHaveBeenCalledWith(expectedProfileId);
      expect(fetchProviderInfo).not.toHaveBeenCalled();
    });

    it('add error result on invalid provider json', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
            file: '',
            providers: {
              [provider]: {
                file: '',
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: '',
          },
        },
      });
      const expectedProfileId = ProfileId.fromParameters({
        scope: profile.scope,
        name: profile.name,
        version: ProfileVersion.fromString(profile.version),
      });
      const expectedMapId = MapId.fromParameters({
        profile: expectedProfileId,
        provider,
        variant,
        version: MapVersion.fromString('1.0'),
      });

      mocked(isProviderParseError).mockReturnValue(true);
      mocked(loadMap).mockResolvedValue({
        ast: mockMapDocumentWithUnverified,
        from: mockRemoteProfileFrom,
      });
      mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteMapFrom,
      });
      mocked(loadProvider).mockResolvedValue({
        source: mockProviderJson,
        from: mockRemoteProviderFrom,
      });

      expect(
        (
          await check(mockSuperJson, [
            {
              id: expectedProfileId,
              maps: [expectedMapId],
            },
          ])
        ).length
      ).not.toEqual(0);

      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        provider,
        undefined
      );
      expect(loadProfile).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId
      );
      expect(loadMap).toHaveBeenCalledWith(mockSuperJson, expectedMapId);

      expect(fetchMapAST).toHaveBeenCalledWith(expectedMapId);
      expect(fetchProfileAST).toHaveBeenCalledWith(expectedProfileId);
      expect(fetchProviderInfo).toHaveBeenCalledWith(provider);
    });
  });

  describe('when formating human', () => {
    it('returns correctly formated string when empty issues array is passed', async () => {
      expect(
        formatHuman([
          {
            kind: 'profileMap',
            profileId: ProfileId.fromParameters({
              scope: profile.scope,
              name: profile.name,
            }).toString(),
            provider,
            issues: [],
            mapFrom: mockRemoteMapFrom,
            profileFrom: mockRemoteProfileFrom,
          },
        ])
      ).toEqual(
        green(
          `🆗 Checking remote profile ${profile.scope}/${profile.name} with version ${profile.version} and remote map with version ${profile.version} for provider ${provider}\n`
        ) + '\n'
      );
      expect(
        formatHuman([
          {
            kind: 'mapProvider',
            profileId: ProfileId.fromParameters({
              scope: profile.scope,
              name: profile.name,
            }).toString(),
            provider,
            issues: [],
            mapFrom: mockRemoteMapFrom,
            providerFrom: mockRemoteProfileFrom,
          },
        ])
      ).toEqual(
        green(
          `🆗 Checking remote map with version ${profile.version} for profile ${profile.scope}/${profile.name} and remote provider ${provider}\n`
        ) + '\n'
      );

      expect(
        formatHuman([
          {
            kind: 'profileMap',
            profileId: ProfileId.fromParameters({
              scope: profile.scope,
              name: profile.name,
            }).toString(),
            provider,
            issues: [],
            mapFrom: mockLocalMapFrom,
            profileFrom: mockLocalProfileFrom,
          },
        ])
      ).toEqual(
        green(
          `🆗 Checking local profile ${profile.scope}/${profile.name} at path\n${mockLocalProfileFrom.path}\nand local map for provider ${provider} at path\n${mockLocalMapFrom.path}\n\n`
        ) + '\n'
      );
      expect(
        formatHuman([
          {
            kind: 'mapProvider',
            profileId: ProfileId.fromParameters({
              scope: profile.scope,
              name: profile.name,
            }).toString(),
            provider,
            issues: [],
            mapFrom: mockLocalMapFrom,
            providerFrom: mockLocalProviderFrom,
          },
        ])
      ).toEqual(
        green(
          `🆗 Checking local map at path\n${mockLocalMapFrom.path}\nfor profile ${profile.scope}/${profile.name} and local provider ${provider} at path\n${mockLocalProviderFrom.path}\n\n`
        ) + '\n'
      );
    });

    it('returns crrectly formated string when not empty array is passed', async () => {
      const mockResult: CheckResult[] = [
        {
          kind: 'profileMap',
          provider,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockRemoteMapFrom,
          profileId: ProfileId.fromParameters({
            scope: profile.scope,
            name: profile.name,
          }).toString(),
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
          profileId: ProfileId.fromParameters({
            scope: profile.scope,
            name: profile.name,
          }).toString(),
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
      const firstTitle = red(
        `❌ Checking remote profile ${profile.scope}/${profile.name} with version ${profile.version} and remote map with version ${profile.version} for provider ${provider}\n`
      );
      const firstBody = `${red(`❌ first-error\n`)}${yellow(
        `⚠️ first-warn\n`
      )}${red(`❌ second-error\n`)}${yellow(`⚠️ second-warn\n`)}`;

      const secondTitle = red(
        `❌ Checking local map at path\n${mockLocalMapFrom.path}\nfor profile ${profile.scope}/${profile.name} and local provider ${provider} at path\n${mockLocalProviderFrom.path}\n\n`
      );
      const secondBody = `${red(`❌ first-error\n`)}${yellow(
        `⚠️ first-warn\n`
      )}${red(`❌ second-error\n`)}${yellow(`⚠️ second-warn\n`)}`;

      expect(formatHuman(mockResult)).toEqual(
        firstTitle + firstBody + '\n' + secondTitle + secondBody + '\n'
      );
    });
  });

  describe('when formating json', () => {
    it('returns crrectly formated string when empty array is passed', async () => {
      expect(formatJson([])).toEqual(JSON.stringify([]));
    });

    it('returns correctly formated string when not empty array is passed', async () => {
      const mockResult: CheckResult[] = [
        {
          kind: 'mapProvider',
          provider,
          providerFrom: mockRemoteProviderFrom,
          mapFrom: mockRemoteMapFrom,
          profileId: ProfileId.fromParameters({
            scope: profile.scope,
            name: profile.name,
          }).toString(),
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
      expect(formatJson(mockResult)).toEqual(JSON.stringify(mockResult));
    });
  });

  describe('when checking profile and map', () => {
    it('returns empty result if profile and map checks out', async () => {
      expect(checkMapAndProfile(mockProfileDocument, mockMapDocument)).toEqual({
        kind: 'profileMap',
        issues: [],
        profileId: 'starwars/character-information@1.0.3',
        provider,
      });
    });

    it('returns result with errors if profile and map has different name,scope and version', async () => {
      const mockMapDocument: MapDocumentNode = {
        kind: 'MapDocument',
        header: {
          kind: 'MapHeader',
          profile: {
            name: 'informations',
            scope: 'startrek',
            version: {
              major: 2,
              minor: 1,
              patch: 3,
              label: 'some-label',
            },
          },
          provider: 'test-profile',
        },
        definitions: [],
      };

      const mockProfileDocument: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: {
          kind: 'ProfileHeader',
          name: 'character-information',
          scope: 'starwars',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        definitions: [],
      };

      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument).issues.length
      ).toEqual(5);
    });

    it('returns result with errors and warnings if profile and map has different name,scope, version and number of usecasses', async () => {
      const mockMapDocument: MapDocumentNode = {
        kind: 'MapDocument',
        header: {
          kind: 'MapHeader',
          profile: {
            name: 'informations',
            scope: 'startrek',
            version: {
              major: 2,
              minor: 1,
              patch: 3,
              label: 'some-label',
            },
          },
          provider: 'test-profile',
        },
        definitions: [],
      };

      const mockProfileDocument: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: {
          kind: 'ProfileHeader',
          name: 'character-information',
          scope: 'starwars',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'RetrieveCharacterInformation',
            safety: 'safe',
            input: {
              kind: 'UseCaseSlotDefinition',
            },
          },
        ],
      };

      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument).issues.length
      ).toEqual(7);
      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument).issues.filter(
          result => result.kind === 'warn'
        ).length
      ).toEqual(2);
    });

    it('returns result with errors if profile and map has different name,scope, version and number of usecasses -strict', async () => {
      const mockMapDocument: MapDocumentNode = {
        kind: 'MapDocument',
        header: {
          kind: 'MapHeader',
          profile: {
            name: 'informations',
            scope: 'startrek',
            version: {
              major: 2,
              minor: 1,
              patch: 3,
              label: 'some-label',
            },
          },
          provider: 'test-profile',
        },
        definitions: [],
      };

      const mockProfileDocument: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: {
          kind: 'ProfileHeader',
          name: 'character-information',
          scope: 'starwars',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'RetrieveCharacterInformation',
            safety: 'safe',
            input: {
              kind: 'UseCaseSlotDefinition',
            },
          },
        ],
      };

      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument, {
          strict: true,
        }).issues.length
      ).toEqual(7);
      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument, {
          strict: true,
        }).issues.filter(result => result.kind === 'warn').length
      ).toEqual(0);
    });
  });

  describe('when checking provider and map', () => {
    it('returns empty result if provider and map checks out', async () => {
      expect(
        checkMapAndProvider(
          mockUnverifiedProviderJson,
          mockMapDocumentWithUnverified
        )
      ).toEqual({
        issues: [],
        kind: 'mapProvider',
        provider: unverifiedProvider,
        profileId: 'starwars/character-information',
      });
    });

    it('returns result with errors if provider and map has different name', async () => {
      const mockMapDocument: MapDocumentNode = {
        kind: 'MapDocument',
        header: {
          kind: 'MapHeader',
          profile: {
            name: 'character-information',
            scope: 'starwars',
            version: {
              major: 1,
              minor: 0,
              patch: 3,
            },
          },
          provider: unverifiedProvider,
        },
        definitions: [],
      };

      const mockProviderJson: ProviderJson = {
        name: `${UNVERIFIED_PROVIDER_PREFIX}test`,
        services: [{ id: 'test-service', baseUrl: 'service/base/url' }],
        securitySchemes: [
          {
            type: SecurityType.HTTP,
            id: 'basic',
            scheme: HttpScheme.BASIC,
          },
          {
            id: 'api',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.HEADER,
            name: 'Authorization',
          },
          {
            id: 'bearer',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BEARER,
            bearerFormat: 'some',
          },
          {
            id: 'digest',
            type: SecurityType.HTTP,
            scheme: HttpScheme.DIGEST,
          },
        ],
        defaultService: 'test-service',
      };
      expect(checkMapAndProvider(mockProviderJson, mockMapDocument)).toEqual({
        kind: 'mapProvider',
        issues: [
          {
            kind: 'error',
            message: `Map contains provider with name: "${unverifiedProvider}" but provider.json contains provider with name: "${mockProviderJson.name}"`,
          },
        ],
        profileId: 'starwars/character-information',
        provider: mockProviderJson.name,
      });
    });
  });
});
