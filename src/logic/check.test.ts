import type {
  AstMetadata,
  MapDocumentNode,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import { ApiKeyPlacement, HttpScheme, SecurityType } from '@superfaceai/ast';

import { MockLogger, UNVERIFIED_PROVIDER_PREFIX } from '../common';
import {
  fetchMapAST,
  fetchProfileAST,
  fetchProviderInfo,
} from '../common/http';
import { ProfileId } from '../common/profile';
import type { CheckResult } from './check';
import {
  check,
  checkIntegrationParameters,
  checkMapAndProfile,
  checkMapAndProvider,
  formatHuman,
  formatJson,
} from './check';
import { isProviderParseError } from './check.utils';
import type {
  MapFromMetadata,
  ProfileFromMetadata,
  ProviderFromMetadata,
} from './publish/publish.utils';
import { loadMap, loadProfile, loadProvider } from './publish/publish.utils';

jest.mock('./publish.utils', () => ({
  loadMap: jest.fn(),
  loadProfile: jest.fn(),
  loadProvider: jest.fn(),
}));

jest.mock('./check.utils', () => ({
  findLocalProviderSource: jest.fn(),
  isProviderParseError: jest.fn(),
}));

jest.mock('../common/http', () => ({
  fetchProfileAST: jest.fn(),
  fetchMapAST: jest.fn(),
  fetchProviderInfo: jest.fn(),
}));

describe('Check logic', () => {
  let logger: MockLogger;

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

  const mockMapDocument: MapDocumentNode = {
    kind: 'MapDocument',
    astMetadata,
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
    astMetadata,
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
    astMetadata,
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

  beforeEach(() => {
    logger = new MockLogger();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when checking capability', () => {
    it('returns correctly formated result when we use local files', async () => {
      const mockProfile = {
        name: 'character-information',
      };
      const mockSuperJson = {
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
      };
      jest.mocked(loadMap).mockResolvedValue({
        from: mockLocalMapFrom,
        ast: mockMapDocumentWithUnverified,
      });
      jest.mocked(loadProfile).mockResolvedValue({
        from: mockLocalProfileFrom,
        ast: mockProfileDocument,
      });
      jest.mocked(loadProvider).mockResolvedValue({
        source: mockUnverifiedProviderJson,
        from: mockLocalProviderFrom,
      });

      await expect(
        check(
          mockSuperJson,
          '',
          [
            {
              id: ProfileId.fromScopeName(undefined, mockProfile.name),
              maps: [{ provider: unverifiedProvider }],
            },
          ],
          { logger }
        )
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
        {
          kind: 'parameters',
          providerFrom: mockLocalProviderFrom,
          issues: [],
          provider: unverifiedProvider,
          superJsonPath: '',
        },
      ]);

      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        unverifiedProvider,
        expect.anything()
      );
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromScopeName(undefined, mockProfile.name),
          version: undefined,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromScopeName(undefined, mockProfile.name),
          provider: unverifiedProvider,
          map: { variant: undefined },
          version: undefined,
        },
        expect.anything()
      );
      expect(fetchMapAST).not.toHaveBeenCalled();
      expect(fetchProfileAST).not.toHaveBeenCalled();
      expect(fetchProviderInfo).not.toHaveBeenCalled();
    });

    it('returns correctly formated result when we use remote files', async () => {
      const mockSuperJson = {
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
      };
      jest.mocked(loadMap).mockResolvedValue({
        ast: mockMapDocumentWithUnverified,
        from: mockRemoteMapFrom,
      });
      jest.mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      jest.mocked(loadProvider).mockResolvedValue({
        source: mockUnverifiedProviderJson,
        from: mockRemoteProviderFrom,
      });

      await expect(
        check(
          mockSuperJson,
          '',
          [
            {
              id: ProfileId.fromScopeName(profile.scope, profile.name),
              version: profile.version,
              maps: [{ provider: unverifiedProvider, variant }],
            },
          ],
          { logger }
        )
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
        {
          kind: 'parameters',
          providerFrom: mockRemoteProviderFrom,
          issues: [],
          provider: unverifiedProvider,
          superJsonPath: '',
        },
      ]);

      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        unverifiedProvider,
        expect.anything()
      );
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromScopeName(profile.scope, profile.name),
          version: profile.version,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromScopeName(profile.scope, profile.name),
          provider: unverifiedProvider,
          map: { variant },
          version: '1.0.3',
        },
        expect.anything()
      );
    });

    it('throws error on invalid map document', async () => {
      const mockSuperJson = {
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
      };
      jest.mocked(loadMap).mockResolvedValue({
        ast: {} as MapDocumentNode,
        from: mockRemoteMapFrom,
      });
      jest.mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteProfileFrom,
      });
      jest.mocked(loadProvider).mockResolvedValue({
        source: mockProviderJson,
        from: mockRemoteProviderFrom,
      });

      await expect(
        check(
          mockSuperJson,
          '',
          [
            {
              id: ProfileId.fromScopeName(profile.scope, profile.name),
              version: profile.version,
              maps: [{ provider, variant }],
            },
          ],
          { logger }
        )
      ).rejects.toThrow();

      expect(loadProvider).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromScopeName(profile.scope, profile.name),
          version: profile.version,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromScopeName(profile.scope, profile.name),
          provider,
          map: { variant },
          version: '1.0.3',
        },
        expect.anything()
      );

      expect(fetchProviderInfo).not.toHaveBeenCalled();
    });

    it('throws error on invalid profile document', async () => {
      const mockSuperJson = {
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
      };
      jest.mocked(loadMap).mockResolvedValue({
        ast: mockMapDocument,
        from: mockRemoteMapFrom,
      });
      jest.mocked(loadProfile).mockResolvedValue({
        ast: {} as ProfileDocumentNode,
        from: mockRemoteProfileFrom,
      });
      jest.mocked(loadProvider).mockResolvedValue({
        source: mockProviderJson,
        from: mockRemoteProviderFrom,
      });
      await expect(
        check(
          mockSuperJson,
          '',
          [
            {
              id: ProfileId.fromScopeName(profile.scope, profile.name),
              version: profile.version,
              maps: [{ provider, variant }],
            },
          ],
          { logger }
        )
      ).rejects.toThrow();

      expect(loadProvider).not.toHaveBeenCalled();
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromScopeName(profile.scope, profile.name),
          version: profile.version,
        },
        expect.anything()
      );
      expect(loadMap).not.toHaveBeenCalled();

      expect(fetchProviderInfo).not.toHaveBeenCalled();
    });

    it('add error result on invalid provider json', async () => {
      const mockSuperJson = {
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
      };
      jest.mocked(isProviderParseError).mockReturnValue(true);
      jest.mocked(loadMap).mockResolvedValue({
        ast: mockMapDocumentWithUnverified,
        from: mockRemoteProfileFrom,
      });
      jest.mocked(loadProfile).mockResolvedValue({
        ast: mockProfileDocument,
        from: mockRemoteMapFrom,
      });
      jest.mocked(loadProvider).mockResolvedValue({
        source: mockProviderJson,
        from: mockRemoteProviderFrom,
      });

      expect(
        (
          await check(
            mockSuperJson,
            '',
            [
              {
                id: ProfileId.fromScopeName(profile.scope, profile.name),
                version: profile.version,
                maps: [{ provider, variant }],
              },
            ],
            { logger }
          )
        ).length
      ).not.toEqual(0);

      expect(loadProvider).toHaveBeenCalledWith(
        mockSuperJson,
        '',
        provider,
        expect.anything()
      );
      expect(loadProfile).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromScopeName(profile.scope, profile.name),
          version: profile.version,
        },
        expect.anything()
      );
      expect(loadMap).toHaveBeenCalledWith(
        {
          superJson: mockSuperJson,
          superJsonPath: '',
          profile: ProfileId.fromScopeName(profile.scope, profile.name),
          provider,
          map: { variant },
          version: '1.0.3',
        },
        expect.anything()
      );
    });
  });

  describe('when formating human', () => {
    it('returns correctly formated string when empty issues array is passed', async () => {
      expect(
        formatHuman({
          checkResults: [
            {
              kind: 'profileMap',
              profileId: ProfileId.fromScopeName(
                profile.scope,
                profile.name
              ).toString(),
              provider,
              issues: [],
              mapFrom: mockRemoteMapFrom,
              profileFrom: mockRemoteProfileFrom,
            },
          ],
          color: false,
          emoji: false,
        })
      ).toMatch(
        `Checking remote profile "${profile.scope}/${profile.name}" with version "${profile.version}" and remote map with version "${profile.version}" for provider "${provider}"`
      );
      expect(
        formatHuman({
          checkResults: [
            {
              kind: 'mapProvider',
              profileId: ProfileId.fromScopeName(
                profile.scope,
                profile.name
              ).toString(),
              provider,
              issues: [],
              mapFrom: mockRemoteMapFrom,
              providerFrom: mockRemoteProfileFrom,
            },
          ],
          emoji: false,
          color: false,
        })
      ).toMatch(
        `Checking remote map with version "${profile.version}" for profile "${profile.scope}/${profile.name}" and remote provider "${provider}"`
      );

      let result = formatHuman({
        checkResults: [
          {
            kind: 'profileMap',
            profileId: ProfileId.fromScopeName(
              profile.scope,
              profile.name
            ).toString(),
            provider,
            issues: [],
            mapFrom: mockLocalMapFrom,
            profileFrom: mockLocalProfileFrom,
          },
        ],
        emoji: false,
        color: false,
      });
      expect(result).toMatch(
        `Checking local profile "${profile.scope}/${profile.name}" at path`
      );
      expect(result).toMatch(mockLocalProfileFrom.path);
      expect(result).toMatch(
        `and local map for provider "${provider}" at path`
      );
      expect(result).toMatch(mockLocalMapFrom.path);

      result = formatHuman({
        checkResults: [
          {
            kind: 'mapProvider',
            profileId: ProfileId.fromScopeName(
              profile.scope,
              profile.name
            ).toString(),
            provider,
            issues: [],
            mapFrom: mockLocalMapFrom,
            providerFrom: mockLocalProviderFrom,
          },
        ],
        emoji: false,
        color: false,
      });
      expect(result).toMatch('Checking local map at path');
      expect(result).toMatch(mockLocalMapFrom.path);
      expect(result).toMatch(
        `for profile "${profile.scope}/${profile.name}" and local provider "${provider}" at path`
      );
      expect(result).toMatch(mockLocalProviderFrom.path);
    });

    it('returns crrectly formated string when not empty array is passed', async () => {
      const mockResult: CheckResult[] = [
        {
          kind: 'profileMap',
          provider,
          profileFrom: mockRemoteProfileFrom,
          mapFrom: mockRemoteMapFrom,
          profileId: ProfileId.fromScopeName(
            profile.scope,
            profile.name
          ).toString(),
          issues: [
            {
              kind: 'error',
              message: 'first-check-first-error',
            },
            {
              kind: 'warn',
              message: 'first-check-first-warn',
            },
            {
              kind: 'error',
              message: 'first-check-second-error',
            },
            {
              kind: 'warn',
              message: 'first-check-second-warn',
            },
          ],
        },
        {
          kind: 'mapProvider',
          provider,
          providerFrom: mockLocalProviderFrom,
          mapFrom: mockLocalMapFrom,
          profileId: ProfileId.fromScopeName(
            profile.scope,
            profile.name
          ).toString(),
          issues: [
            {
              kind: 'error',
              message: 'second-check-first-error',
            },
            {
              kind: 'warn',
              message: 'second-check-first-warn',
            },
            {
              kind: 'error',
              message: 'second-check-second-error',
            },
            {
              kind: 'warn',
              message: 'second-check-second-warn',
            },
          ],
        },
        {
          kind: 'parameters',
          provider,
          providerFrom: mockLocalProviderFrom,
          superJsonPath: 'some/path',
          issues: [
            {
              kind: 'error',
              message: 'third-check-first-error',
            },
            {
              kind: 'warn',
              message: 'third-check-first-warn',
            },
            {
              kind: 'error',
              message: 'third-check-second-error',
            },
            {
              kind: 'warn',
              message: 'third-check-second-warn',
            },
          ],
        },
      ];
      const formated = formatHuman({
        checkResults: mockResult,
        emoji: false,
        color: false,
      });
      // First title
      expect(formated).toMatch(
        `Checking remote profile "${profile.scope}/${profile.name}" with version "${profile.version}" and remote map with version "${profile.version}" for provider "${provider}"`
      );

      // First body
      expect(formated).toMatch('first-check-first-error');
      expect(formated).toMatch('first-check-first-warn');
      expect(formated).toMatch('first-check-second-error');
      expect(formated).toMatch('first-check-second-warn');

      // Second title
      expect(formated).toMatch('Checking local map at path');
      expect(formated).toMatch(mockLocalMapFrom.path);
      expect(formated).toMatch(
        `for profile "${profile.scope}/${profile.name}" and local provider "${provider}" at path`
      );
      expect(formated).toMatch(mockLocalProviderFrom.path);
      // Second body
      expect(formated).toMatch('second-check-first-error');
      expect(formated).toMatch('second-check-first-warn');
      expect(formated).toMatch('second-check-second-error');
      expect(formated).toMatch('second-check-second-warn');

      // Third title
      expect(formated).toMatch(
        'Checking integration parameters of local provider at path'
      );
      expect(formated).toMatch(mockLocalProviderFrom.path);
      expect(formated).toMatch('and super.json at path');
      expect(formated).toMatch('some/path');
      // Third body
      expect(formated).toMatch('third-check-first-error');
      expect(formated).toMatch('third-check-first-warn');
      expect(formated).toMatch('third-check-second-error');
      expect(formated).toMatch('third-check-second-warn');
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
          profileId: ProfileId.fromScopeName(
            profile.scope,
            profile.name
          ).toString(),
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
      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument, { logger })
      ).toEqual({
        kind: 'profileMap',
        issues: [],
        profileId: 'starwars/character-information@1.0.3',
        provider,
      });
    });

    it('returns result with errors if profile and map has different name,scope and version', async () => {
      const mockMapDocument: MapDocumentNode = {
        kind: 'MapDocument',
        astMetadata,
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
        astMetadata,
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
        checkMapAndProfile(mockProfileDocument, mockMapDocument, { logger })
          .issues.length
      ).toEqual(5);
    });

    it('returns result with errors and warnings if profile and map has different name,scope, version and number of usecasses', async () => {
      const mockMapDocument: MapDocumentNode = {
        kind: 'MapDocument',
        astMetadata,
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
        astMetadata,
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
          },
        ],
      };

      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument, { logger })
          .issues.length
      ).toEqual(7);
      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument, {
          logger,
        }).issues.filter(result => result.kind === 'warn').length
      ).toEqual(2);
    });

    it('returns result with errors if profile and map has different name,scope, version and number of usecasses -strict', async () => {
      const mockMapDocument: MapDocumentNode = {
        kind: 'MapDocument',
        astMetadata,
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
        astMetadata,
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
          },
        ],
      };

      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument, {
          strict: true,
          logger,
        }).issues.length
      ).toEqual(7);
      expect(
        checkMapAndProfile(mockProfileDocument, mockMapDocument, {
          strict: true,
          logger,
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
        astMetadata,
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

  describe('when checking integration parameters', () => {
    it('returns empty result if there are no integration parameters', async () => {
      const mockSuperJson = {
        profiles: {
          [profile.name]: {
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
      };
      expect(
        checkIntegrationParameters(mockProviderJson, mockSuperJson)
      ).toEqual({
        issues: [],
        kind: 'parameters',
        provider: provider,
      });
    });

    it('returns result with warnings if there are extra integration parameters in super.json', async () => {
      const mockSuperJson = {
        profiles: {
          [profile.name]: {
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
            parameters: {
              first: '$FIRST',
              extra: 'hi, i am extra',
            },
          },
        },
      };

      const mockProviderJson: ProviderJson = {
        name: provider,
        services: [{ id: 'test-service', baseUrl: 'service/base/url' }],
        securitySchemes: [],
        defaultService: 'test-service',
        parameters: [
          {
            name: 'first',
          },
        ],
      };
      expect(
        checkIntegrationParameters(mockProviderJson, mockSuperJson)
      ).toEqual({
        issues: [
          {
            kind: 'warn',
            message: `Super.json defines parameter: extra which is not needed in provider ${provider}`,
          },
        ],
        kind: 'parameters',
        provider: provider,
      });
    });

    it('returns result with errors if there are integration parameters missing in super.json', async () => {
      const mockSuperJson = {
        profiles: {
          [profile.name]: {
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
            parameters: {
              first: '$FIRST',
              extra: 'hi, i am extra',
            },
          },
        },
      };

      const mockProviderJson: ProviderJson = {
        name: provider,
        services: [{ id: 'test-service', baseUrl: 'service/base/url' }],
        securitySchemes: [],
        defaultService: 'test-service',
        parameters: [
          {
            name: 'first',
          },
          {
            name: 'second',
          },
        ],
      };
      expect(
        checkIntegrationParameters(mockProviderJson, mockSuperJson)
      ).toEqual({
        issues: [
          {
            kind: 'warn',
            message: `Super.json defines parameter: extra which is not needed in provider ${provider}`,
          },
          {
            kind: 'error',
            message: `Parameter second is not defined in super.json for provider ${provider}`,
          },
        ],
        kind: 'parameters',
        provider: provider,
      });
    });

    it('returns result with error if there are not matching provider names super.json and provider.json', async () => {
      const mockSuperJson = {
        profiles: {
          [profile.name]: {
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
            parameters: {
              first: '$FIRST',
            },
          },
        },
      };

      const mockProviderJson: ProviderJson = {
        name: 'different',
        services: [{ id: 'test-service', baseUrl: 'service/base/url' }],
        securitySchemes: [],
        defaultService: 'test-service',
        parameters: [
          {
            name: 'first',
          },
          {
            name: 'second',
          },
        ],
      };
      expect(
        checkIntegrationParameters(mockProviderJson, mockSuperJson)
      ).toEqual({
        issues: [
          {
            kind: 'error',
            message: 'Provider different is not defined in super.json',
          },
        ],
        kind: 'parameters',
        provider: 'different',
      });
    });
  });
});
