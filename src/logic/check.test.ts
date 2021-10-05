import { CLIError } from '@oclif/errors';
import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import {
  ApiKeyPlacement,
  HttpScheme,
  Parser,
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
import {
  findLocalMapSource,
  findLocalProfileSource,
  findLocalProviderSource,
  isProviderParseError,
} from './check.utils';

//Mock check utils
jest.mock('./check.utils', () => ({
  findLocalProfileSource: jest.fn(),
  findLocalMapSource: jest.fn(),
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
    version: '1.0.0',
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
      mocked(findLocalMapSource).mockResolvedValue(mockMapSource);
      mocked(findLocalProfileSource).mockResolvedValue(mockProfileSource);
      mocked(findLocalProviderSource).mockResolvedValue(
        mockUnverifiedProviderJson
      );
      const parseMapSpy = jest
        .spyOn(Parser, 'parseMap')
        .mockResolvedValue(mockMapDocumentWithUnverified);
      const parseProfileSpy = jest
        .spyOn(Parser, 'parseProfile')
        .mockResolvedValue(mockProfileDocument);

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
        check(mockSuperJson, expectedProfileId, expectedMapId)
      ).resolves.toEqual([]);

      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        unverifiedProvider
      );
      expect(findLocalProfileSource).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId
      );
      expect(findLocalMapSource).toHaveBeenCalledWith(
        mockSuperJson,
        expectedMapId
      );
      expect(parseProfileSpy).toHaveBeenCalled();
      expect(parseMapSpy).toHaveBeenCalled();
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
      mocked(findLocalMapSource).mockResolvedValue(undefined);
      mocked(findLocalProfileSource).mockResolvedValue(undefined);
      mocked(findLocalProviderSource).mockResolvedValue(undefined);
      mocked(fetchMapAST).mockResolvedValue(mockMapDocumentWithUnverified);
      mocked(fetchProfileAST).mockResolvedValue(mockProfileDocument);
      mocked(fetchProviderInfo).mockResolvedValue(mockUnverifiedProviderJson);
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
      await expect(
        check(mockSuperJson, expectedProfileId, expectedMapId)
      ).resolves.toEqual([]);

      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        unverifiedProvider
      );
      expect(findLocalProfileSource).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId
      );
      expect(findLocalMapSource).toHaveBeenCalledWith(
        mockSuperJson,
        expectedMapId
      );

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
      mocked(findLocalMapSource).mockResolvedValue(undefined);
      mocked(findLocalProfileSource).mockResolvedValue(undefined);
      mocked(findLocalProviderSource).mockResolvedValue(undefined);
      mocked(fetchMapAST).mockResolvedValue({} as MapDocumentNode);
      mocked(fetchProfileAST).mockResolvedValue(mockProfileDocument);
      mocked(fetchProviderInfo).mockResolvedValue(mockProviderJson);
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

      await expect(
        check(mockSuperJson, expectedProfileId, expectedMapId)
      ).rejects.toEqual(new CLIError('Map file has unknown structure'));

      expect(findLocalProviderSource).not.toHaveBeenCalled();
      expect(findLocalProfileSource).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId
      );
      expect(findLocalMapSource).toHaveBeenCalledWith(
        mockSuperJson,
        expectedMapId
      );

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
      mocked(findLocalMapSource).mockResolvedValue(undefined);
      mocked(findLocalProfileSource).mockResolvedValue(undefined);
      mocked(findLocalProviderSource).mockResolvedValue(undefined);
      mocked(fetchMapAST).mockResolvedValue(mockMapDocument);
      mocked(fetchProfileAST).mockResolvedValue({} as ProfileDocumentNode);
      mocked(fetchProviderInfo).mockResolvedValue(mockProviderJson);
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

      await expect(
        check(mockSuperJson, expectedProfileId, expectedMapId)
      ).rejects.toEqual(new CLIError('Profile file has unknown structure'));

      expect(findLocalProviderSource).not.toHaveBeenCalled();
      expect(findLocalProfileSource).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId
      );
      expect(findLocalMapSource).not.toHaveBeenCalled();

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
      mocked(isProviderParseError).mockReturnValue(true);
      mocked(findLocalMapSource).mockResolvedValue(undefined);
      mocked(findLocalProfileSource).mockResolvedValue(undefined);
      mocked(findLocalProviderSource).mockResolvedValue(undefined);
      mocked(fetchMapAST).mockResolvedValue(mockMapDocumentWithUnverified);
      mocked(fetchProfileAST).mockResolvedValue(mockProfileDocument);
      mocked(fetchProviderInfo).mockResolvedValue(mockProviderJson);
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

      expect(
        (await check(mockSuperJson, expectedProfileId, expectedMapId)).length
      ).not.toEqual(0);

      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        provider
      );
      expect(findLocalProfileSource).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId
      );
      expect(findLocalMapSource).toHaveBeenCalledWith(
        mockSuperJson,
        expectedMapId
      );

      expect(fetchMapAST).toHaveBeenCalledWith(expectedMapId);
      expect(fetchProfileAST).toHaveBeenCalledWith(expectedProfileId);
      expect(fetchProviderInfo).toHaveBeenCalledWith(provider);
    });
  });

  describe('when formating human', () => {
    it('returns correctly formated string when empty array is passed', async () => {
      expect(formatHuman([])).toEqual(green(`🆗 check without errors.\n`));
    });

    it('returns crrectly formated string when not empty array is passed', async () => {
      const mockResult: CheckResult[] = [
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
      ];
      const expected = `${red(`❌ first-error\n`)}${yellow(
        `⚠️ first-warn\n`
      )}${red(`❌ second-error\n`)}${yellow(`⚠️ second-warn\n`)}`;
      expect(formatHuman(mockResult)).toEqual(expected);
    });
  });

  describe('when formating json', () => {
    it('returns crrectly formated string when empty array is passed', async () => {
      expect(formatJson([])).toEqual(JSON.stringify([]));
    });

    it('returns crrectly formated string when not empty array is passed', async () => {
      const mockResult: CheckResult[] = [
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
      ];
      expect(formatJson(mockResult)).toEqual(JSON.stringify(mockResult));
    });
  });

  describe('when checking profile and map', () => {
    it('returns empty result if profile and map checks out', async () => {
      expect(checkMapAndProfile(mockProfileDocument, mockMapDocument)).toEqual(
        []
      );
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
        checkMapAndProfile(mockProfileDocument, mockMapDocument).length
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
        checkMapAndProfile(mockProfileDocument, mockMapDocument).length
      ).toEqual(7);
      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument).filter(
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
        }).length
      ).toEqual(7);
      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument, {
          strict: true,
        }).filter(result => result.kind === 'warn').length
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
      ).toEqual([]);
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
      expect(checkMapAndProvider(mockProviderJson, mockMapDocument)).toEqual([
        {
          kind: 'error',
          message: `Map contains provider with name: "${unverifiedProvider}" but provider.json contains provider with name: "${mockProviderJson.name}"`,
        },
      ]);
    });
  });
});
