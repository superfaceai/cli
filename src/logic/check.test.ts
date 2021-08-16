import { CLIError } from '@oclif/errors';
import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import {
  ApiKeyPlacement,
  HttpScheme,
  ProviderJson,
  SecurityType,
  SuperJson,
} from '@superfaceai/one-sdk';
import { parseMap, parseProfile } from '@superfaceai/parser';
import { green, red, yellow } from 'chalk';
import { mocked } from 'ts-jest/utils';

import {
  fetchMapAST,
  fetchProfileAST,
  fetchProviderInfo,
} from '../common/http';
import {
  check,
  checkMapAndProfile,
  CheckResult,
  formatHuman,
  formatJson,
} from './check';
import {
  findLocalMapSource,
  findLocalProfileSource,
  findLocalProviderSource,
} from './check.utils';

//Mock parser
jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual<Record<string, unknown>>('@superfaceai/parser'),
  parseProfile: jest.fn(),
  parseMap: jest.fn(),
}));

//Mock check utils
jest.mock('./check.utils', () => ({
  findLocalProfileSource: jest.fn(),
  findLocalMapSource: jest.fn(),
  findLocalProviderSource: jest.fn(),
}));

//Mock http
jest.mock('../common/http', () => ({
  fetchProfileAST: jest.fn(),
  fetchMapAST: jest.fn(),
  fetchProviderInfo: jest.fn(),
}));

describe('Check utils', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  const profile = {
    name: 'character-information',
    scope: 'starwars',
    version: '1.0.0',
  };

  const provider = 'swapi';

  const map = {
    variant: 'variant',
  };
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
      provider: 'test-profile',
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
    name: 'test',
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
      mocked(findLocalMapSource).mockResolvedValue(mockMapSource);
      mocked(findLocalProfileSource).mockResolvedValue(mockProfileSource);
      mocked(findLocalProviderSource).mockResolvedValue(mockProviderJson);
      mocked(parseMap).mockReturnValue(mockMapDocument);
      mocked(parseProfile).mockReturnValue(mockProfileDocument);

      await expect(
        check(mockSuperJson, mockProfile, provider, map)
      ).resolves.toEqual([]);

      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        provider
      );
      expect(findLocalProfileSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProfile
      );
      expect(findLocalMapSource).toHaveBeenCalledWith(
        mockSuperJson,
        mockProfile,
        provider
      );

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
      mocked(fetchProfileAST).mockResolvedValue(mockProfileDocument);
      mocked(fetchProviderInfo).mockResolvedValue(mockProviderJson);

      await expect(
        check(mockSuperJson, profile, provider, map)
      ).resolves.toEqual([]);

      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        provider
      );
      expect(findLocalProfileSource).toHaveBeenCalledWith(
        mockSuperJson,
        profile
      );
      expect(findLocalMapSource).toHaveBeenCalledWith(
        mockSuperJson,
        profile,
        provider
      );

      expect(fetchMapAST).toHaveBeenCalledWith(
        profile.name,
        provider,
        profile.scope,
        profile.version,
        map.variant
      );
      expect(fetchProfileAST).toHaveBeenCalledWith(
        `${profile.scope}/${profile.name}@${profile.version}`
      );
      expect(fetchProviderInfo).toHaveBeenCalledWith(provider);
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

      await expect(
        check(mockSuperJson, profile, provider, map)
      ).rejects.toEqual(new CLIError('Map file has unknown structure'));

      expect(findLocalProviderSource).not.toHaveBeenCalled();
      expect(findLocalProfileSource).toHaveBeenCalledWith(
        mockSuperJson,
        profile
      );
      expect(findLocalMapSource).toHaveBeenCalledWith(
        mockSuperJson,
        profile,
        provider
      );

      expect(fetchMapAST).toHaveBeenCalledWith(
        profile.name,
        provider,
        profile.scope,
        profile.version,
        map.variant
      );
      expect(fetchProfileAST).toHaveBeenCalledWith(
        `${profile.scope}/${profile.name}@${profile.version}`
      );
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

      await expect(
        check(mockSuperJson, profile, provider, map)
      ).rejects.toEqual(new CLIError('Profile file has unknown structure'));

      expect(findLocalProviderSource).not.toHaveBeenCalled();
      expect(findLocalProfileSource).toHaveBeenCalledWith(
        mockSuperJson,
        profile
      );
      expect(findLocalMapSource).not.toHaveBeenCalled();

      expect(fetchMapAST).not.toHaveBeenCalled();
      expect(fetchProfileAST).toHaveBeenCalledWith(
        `${profile.scope}/${profile.name}@${profile.version}`
      );
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
      mocked(findLocalMapSource).mockResolvedValue(undefined);
      mocked(findLocalProfileSource).mockResolvedValue(undefined);
      mocked(findLocalProviderSource).mockResolvedValue(undefined);
      mocked(fetchMapAST).mockResolvedValue(mockMapDocument);
      mocked(fetchProfileAST).mockResolvedValue(mockProfileDocument);
      mocked(fetchProviderInfo).mockResolvedValue({} as ProviderJson);

      expect(
        (await check(mockSuperJson, profile, provider, map)).length
      ).not.toEqual(0);

      expect(findLocalProviderSource).toHaveBeenCalledWith(
        mockSuperJson,
        provider
      );
      expect(findLocalProfileSource).toHaveBeenCalledWith(
        mockSuperJson,
        profile
      );
      expect(findLocalMapSource).toHaveBeenCalledWith(
        mockSuperJson,
        profile,
        provider
      );

      expect(fetchMapAST).toHaveBeenCalledWith(
        profile.name,
        provider,
        profile.scope,
        profile.version,
        map.variant
      );
      expect(fetchProfileAST).toHaveBeenCalledWith(
        `${profile.scope}/${profile.name}@${profile.version}`
      );
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
});
