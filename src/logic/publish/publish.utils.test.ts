import type {
  AstMetadata,
  MapDocumentNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';

import { MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import {
  fetchMapAST,
  fetchProfileAST,
  fetchProviderInfo,
} from '../../common/http';
import { ProfileId } from '../../common/profile';
import type { ProfileMapReport } from '../../common/report.interfaces';
import {
  findLocalMapSource,
  findLocalProfileSource,
  findLocalProviderSource,
} from '../check.utils';
import type {
  MapFromMetadata,
  ProfileFromMetadata,
  ProviderFromMetadata,
} from './publish.utils';
import {
  loadMap,
  loadProfile,
  loadProvider,
  prePublishCheck,
  prePublishLint,
} from './publish.utils';

jest.mock('./check.utils', () => ({
  ...jest.requireActual<Record<string, unknown>>('./check.utils'),
  findLocalProfileSource: jest.fn(),
  findLocalMapSource: jest.fn(),
  findLocalProviderSource: jest.fn(),
}));
jest.mock('../common/http', () => ({
  fetchProfileAST: jest.fn(),
  fetchMapAST: jest.fn(),
  fetchProviderInfo: jest.fn(),
}));

jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual('@superfaceai/parser'),
  parseProfile: jest.fn(),
  parseMap: jest.fn(),
}));

describe('Publish logic utils', () => {
  let logger: MockLogger;
  const userError = createUserError(false);

  const mockProfileId = 'starwars/character-information';
  const mockProfile = ProfileId.fromId(mockProfileId, { userError });
  const mockProviderName = 'unverified-swapi';

  const astMetadata: AstMetadata = {
    sourceChecksum: 'check',
    astVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    parserVersion: {
      major: 2,
      minor: 0,
      patch: 0,
    },
  };
  const validProfileDocument: ProfileDocumentNode = {
    astMetadata,
    kind: 'ProfileDocument',
    header: {
      kind: 'ProfileHeader',
      name: mockProfile.name,
      scope: mockProfile.scope,
      version: {
        major: 1,
        minor: 0,
        patch: 0,
      },
    },
    definitions: [],
  };

  const invalidProfileDocument: ProfileDocumentNode = {
    astMetadata,
    kind: 'ProfileDocument',
    header: {
      kind: 'ProfileHeader',
      name: 'some',
      version: {
        major: 1,
        minor: 0,
        patch: 0,
      },
    },
    definitions: [],
  };

  const validMapDocument: MapDocumentNode = {
    astMetadata,
    kind: 'MapDocument',
    header: {
      kind: 'MapHeader',
      profile: {
        name: mockProfile.name,
        scope: mockProfile.scope,
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      },
      provider: mockProviderName,
    },
    definitions: [],
  };

  const invalidMapDocument: MapDocumentNode = {
    astMetadata,
    kind: 'MapDocument',
    header: {
      kind: 'MapHeader',
      profile: {
        name: mockProfile.name,
        scope: mockProfile.scope,
        version: {
          major: 3,
          minor: 0,
          patch: 0,
        },
      },
      provider: 'test-profile',
    },
    definitions: [],
  };

  const validProviderSource = {
    name: mockProviderName,
    services: [
      {
        id: 'default',
        baseUrl: 'https://swapi.dev/api',
      },
    ],
    defaultService: 'default',
  };

  const invalidProviderSource = {
    name: 'someName',
    services: [
      {
        id: 'default',
        baseUrl: 'https://swapi.dev/api',
      },
    ],
    defaultService: 'default',
  };

  const emptyLintResult: ProfileMapReport = {
    kind: 'compatibility',
    profile: '',
    path: '',
    errors: [],
    warnings: [],
  };

  const mockProfileSource = 'profile source';
  const mockMapSource = 'map source';
  const mockSuperJson = {
    providers: {
      ['swapi']: {},
      ['someName']: {},
      [mockProviderName]: {},
    },
  };

  const mockProfileFrom: ProfileFromMetadata = {
    kind: 'local',
    source: mockProfileSource,
    path: 'mock profile path',
  };

  const mockMapFrom: MapFromMetadata = {
    kind: 'local',
    source: mockMapSource,
    path: 'mock map path',
  };

  const mockProviderFrom: ProviderFromMetadata = {
    kind: 'local',
    path: 'mock provider path',
  };

  beforeEach(() => {
    logger = new MockLogger();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running pre publish check', () => {
    it('throws error on invalid profile document structure', async () => {
      expect(() =>
        prePublishCheck(
          {
            publishing: 'profile',
            profileAst: {} as ProfileDocumentNode,
            mapAst: validMapDocument,
            providerJson: validProviderSource,
            profileFrom: mockProfileFrom,
            providerFrom: mockProviderFrom,
            mapFrom: mockMapFrom,
            superJson: mockSuperJson,
            superJsonPath: '',
          },
          { logger, userError }
        )
      ).toThrow('must have required property "astMetadata"');
    });

    it('throws error on invalid map document structure', async () => {
      expect(() =>
        prePublishCheck(
          {
            publishing: 'profile',
            profileAst: validProfileDocument,
            mapAst: {} as MapDocumentNode,
            providerJson: validProviderSource,
            profileFrom: mockProfileFrom,
            providerFrom: mockProviderFrom,
            mapFrom: mockMapFrom,
            superJson: mockSuperJson,
            superJsonPath: '',
          },
          { logger, userError }
        )
      ).toThrow('must have required property "astMetadata"');
    });

    it('returns empty array on valid documents', async () => {
      expect(
        prePublishCheck(
          {
            publishing: 'profile',
            profileAst: validProfileDocument,
            mapAst: validMapDocument,
            providerJson: validProviderSource,
            profileFrom: mockProfileFrom,
            providerFrom: mockProviderFrom,
            mapFrom: mockMapFrom,
            superJson: mockSuperJson,
            superJsonPath: '',
          },
          { logger, userError }
        )
      ).toEqual([
        {
          kind: 'profileMap',
          issues: [],
          profileId: 'starwars/character-information@1.0.0',
          provider: 'unverified-swapi',
          profileFrom: mockProfileFrom,
          mapFrom: mockMapFrom,
        },
        {
          issues: [],
          kind: 'mapProvider',
          profileId: 'starwars/character-information',
          provider: 'unverified-swapi',
          providerFrom: mockProviderFrom,
          mapFrom: mockMapFrom,
        },
        {
          issues: [],
          kind: 'parameters',
          provider: 'unverified-swapi',
          providerFrom: mockProviderFrom,
          superJsonPath: '',
        },
      ]);
    });

    it('returns array with errors on invalid profile', async () => {
      expect(
        prePublishCheck(
          {
            publishing: 'profile',
            profileAst: invalidProfileDocument,
            mapAst: validMapDocument,
            providerJson: validProviderSource,
            profileFrom: mockProfileFrom,
            providerFrom: mockProviderFrom,
            mapFrom: mockMapFrom,
            superJson: mockSuperJson,
            superJsonPath: '',
          },
          { logger, userError }
        )
          .flatMap(checkResult => checkResult.issues)
          .filter(err => err.kind === 'error').length
      ).toBeGreaterThan(0);
    });

    it('returns array with warnings on invalid profile', async () => {
      expect(
        prePublishCheck(
          {
            publishing: 'provider',
            profileAst: invalidProfileDocument,
            mapAst: {
              ...validMapDocument,
              definitions: [
                {
                  kind: 'MapDefinition',
                  name: 'RetrieveCharacterInformation',
                  usecaseName: 'RetrieveCharacterInformation',
                  statements: [],
                },
              ],
            },
            providerJson: validProviderSource,
            profileFrom: mockProfileFrom,
            providerFrom: mockProviderFrom,
            mapFrom: mockMapFrom,
            superJson: mockSuperJson,
            superJsonPath: '',
          },
          { logger, userError }
        )
          .flatMap(checkResult => checkResult.issues)
          .filter(err => err.kind === 'warn').length
      ).toBeGreaterThan(0);
    });

    it('returns array with errors on invalid map', async () => {
      expect(
        prePublishCheck(
          {
            publishing: 'map',
            profileAst: invalidProfileDocument,
            mapAst: invalidMapDocument,
            providerJson: validProviderSource,
            profileFrom: mockProfileFrom,
            providerFrom: mockProviderFrom,
            mapFrom: mockMapFrom,
            superJson: mockSuperJson,
            superJsonPath: '',
          },
          { logger, userError }
        )
          .flatMap(checkResult => checkResult.issues)
          .filter(err => err.kind === 'error').length
      ).toBeGreaterThan(0);
    });

    it('returns array with warnings on invalid map', async () => {
      expect(
        prePublishCheck(
          {
            publishing: 'provider',
            profileAst: invalidProfileDocument,
            mapAst: {
              ...invalidMapDocument,
              definitions: [
                {
                  kind: 'MapDefinition',
                  name: 'RetrieveCharacterInformation',
                  usecaseName: 'RetrieveCharacterInformation',
                  statements: [],
                },
              ],
            },
            providerJson: validProviderSource,
            profileFrom: mockProfileFrom,
            providerFrom: mockProviderFrom,
            mapFrom: mockMapFrom,
            superJson: mockSuperJson,
            superJsonPath: '',
          },
          { logger, userError }
        )
          .flatMap(checkResult => checkResult.issues)
          .filter(err => err.kind === 'warn').length
      ).toBeGreaterThan(0);
    });

    it('returns array with errors on invalid provider', async () => {
      expect(
        prePublishCheck(
          {
            publishing: 'provider',
            profileAst: validProfileDocument,
            mapAst: validMapDocument,
            providerJson: invalidProviderSource,
            profileFrom: mockProfileFrom,
            providerFrom: mockProviderFrom,
            mapFrom: mockMapFrom,
            superJson: mockSuperJson,
            superJsonPath: '',
          },
          { logger, userError }
        )
          .flatMap(checkResult => checkResult.issues)
          .filter(err => err.kind === 'error').length
      ).toBeGreaterThan(0);
    });
  });

  describe('when running pre publish lint', () => {
    it('returns empty report on valid documents', async () => {
      expect(prePublishLint(validProfileDocument, validMapDocument)).toEqual(
        emptyLintResult
      );
    });

    it('returns reprot on invalid profile', async () => {
      expect(
        prePublishLint(invalidProfileDocument, validMapDocument).errors.length
      ).toBeGreaterThan(0);
    });

    it('returns report on invalid map', async () => {
      expect(
        prePublishLint(invalidProfileDocument, invalidMapDocument).errors.length
      ).toBeGreaterThan(0);
    });
  });

  describe('when loading profile', () => {
    it('loads local profile source and parses it to AST', async () => {
      jest.mocked(findLocalProfileSource).mockResolvedValue({
        source: mockProfileSource,
        path: 'mock profile path',
      });
      const parseProfileSpy = jest
        .mocked(parseProfile)
        .mockReturnValue(validProfileDocument);

      await expect(
        loadProfile(
          {
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: mockProfile,
            version: undefined,
          },
          { logger }
        )
      ).resolves.toEqual({
        ast: validProfileDocument,
        from: {
          kind: 'local',
          source: mockProfileSource,
          path: 'mock profile path',
        },
      });

      expect(parseProfileSpy).toHaveBeenCalledWith(
        new Source(mockProfileSource, mockProfile.id)
      );
      expect(logger.stdout).toContainEqual([
        'localProfileFound',
        [mockProfile.id, 'mock profile path'],
      ]);
    });

    it('loads AST from store', async () => {
      jest.mocked(findLocalProfileSource).mockResolvedValue(undefined);
      jest.mocked(fetchProfileAST).mockResolvedValue(validProfileDocument);
      const parseProfileSpy = jest
        .mocked(parseProfile)
        .mockReturnValue(validProfileDocument);
      await expect(
        loadProfile(
          {
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: mockProfile,
            version: undefined,
          },
          { logger }
        )
      ).resolves.toEqual({
        ast: validProfileDocument,
        from: {
          kind: 'remote',
          version: '1.0.0',
        },
      });

      expect(parseProfileSpy).not.toHaveBeenCalled();
      expect(fetchProfileAST).toHaveBeenCalledWith(mockProfile, undefined);
      expect(logger.stdout).toContainEqual([
        'fetchProfile',
        [mockProfile.id, undefined],
      ]);
    });
  });

  describe('when loading map', () => {
    it('loads local map source and parses it to AST', async () => {
      jest.mocked(findLocalMapSource).mockResolvedValue({
        source: mockMapSource,
        path: 'mock map path',
      });
      const parseMapSpy = jest
        .mocked(parseMap)
        .mockReturnValue(validMapDocument);

      await expect(
        loadMap(
          {
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: mockProfile,
            provider: mockProviderName,
            map: {},
            version: undefined,
          },
          { logger }
        )
      ).resolves.toEqual({
        ast: validMapDocument,
        from: {
          kind: 'local',
          source: mockMapSource,
          path: 'mock map path',
        },
      });

      expect(parseMapSpy).toHaveBeenCalledWith(
        new Source(mockMapSource, `${mockProfile.name}.${mockProviderName}`)
      );

      expect(logger.stdout).toContainEqual([
        'localMapFound',
        [mockProfile.id, mockProviderName, 'mock map path'],
      ]);
    });

    it('loads AST from store', async () => {
      jest.mocked(findLocalMapSource).mockResolvedValue(undefined);
      jest.mocked(fetchMapAST).mockResolvedValue(validMapDocument);
      const parseMapSpy = jest
        .mocked(parseMap)
        .mockReturnValue(validMapDocument);

      await expect(
        loadMap(
          {
            superJson: mockSuperJson,
            superJsonPath: '',
            profile: mockProfile,
            provider: mockProviderName,
            map: {},
            version: undefined,
          },
          { logger }
        )
      ).resolves.toEqual({
        ast: validMapDocument,
        from: {
          kind: 'remote',
          version: '1.0.0',
        },
      });

      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(fetchMapAST).toHaveBeenCalledWith({
        name: mockProfile.name,
        provider: mockProviderName,
        scope: mockProfile.scope,
        version: undefined,
        variant: undefined,
      });

      expect(logger.stdout).toContainEqual([
        'fetchMap',
        [mockProfile.id, mockProviderName, '1.0.0'],
      ]);
    });
  });

  describe('when loading provider', () => {
    it('loads local provider source', async () => {
      jest.mocked(findLocalProviderSource).mockResolvedValue({
        source: validProviderSource,
        path: 'mock provider path',
      });

      await expect(
        loadProvider(mockSuperJson, '', mockProviderName, { logger })
      ).resolves.toEqual({
        source: validProviderSource,
        from: {
          kind: 'local',
          path: 'mock provider path',
        },
      });
      expect(logger.stdout).toContainEqual([
        'localProviderFound',
        [mockProviderName, 'mock provider path'],
      ]);
    });

    it('loads provider json from store', async () => {
      jest.mocked(findLocalProviderSource).mockResolvedValue(undefined);
      jest.mocked(fetchProviderInfo).mockResolvedValue(validProviderSource);

      await expect(
        loadProvider(mockSuperJson, '', mockProviderName, { logger })
      ).resolves.toEqual({
        source: validProviderSource,
        from: {
          kind: 'remote',
        },
      });

      expect(fetchProviderInfo).toHaveBeenCalledWith(mockProviderName);
      expect(logger.stdout).toContainEqual([
        'fetchProvider',
        [mockProviderName],
      ]);
    });
  });
});
