import { CLIError } from '@oclif/errors';
import {
  AstMetadata,
  MapDocumentNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { Parser, SuperJson } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import {
  fetchMapAST,
  fetchProfileAST,
  fetchProviderInfo,
} from '../common/http';
import { ProfileId } from '../common/profile';
import { ProfileMapReport } from '../common/report.interfaces';
import {
  findLocalMapSource,
  findLocalProfileSource,
  findLocalProviderSource,
} from './check.utils';
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

//Mock check util
jest.mock('./check.utils', () => ({
  ...jest.requireActual<Record<string, unknown>>('./check.utils'),
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

const mockLogCb = jest.fn();

describe('Publish logic utils', () => {
  const mockProfileId = 'starwars/character-information';
  const mockProfile = ProfileId.fromId(mockProfileId);
  const mockProviderName = 'unverified-swapi';

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
      name: 'someName',
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
  const mockSuperJson = new SuperJson({
    providers: {
      ['swapi']: {},
      ['someName']: {},
      [mockProviderName]: {},
    },
  });

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

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running pre publish check', () => {
    it('throws error on invalid profile document structure', async () => {
      expect(() =>
        prePublishCheck({
          publishing: 'profile',
          profileAst: {} as ProfileDocumentNode,
          mapAst: validMapDocument,
          providerJson: validProviderSource,
          profileFrom: mockProfileFrom,
          providerFrom: mockProviderFrom,
          mapFrom: mockMapFrom,
          superJson: mockSuperJson,
        })
      ).toThrow(
        new CLIError(
          `Profile AST validation failed at $: expected 'astMetadata' in object, found: {}`
        )
      );
    });

    it('throws error on invalid map document structure', async () => {
      expect(() =>
        prePublishCheck({
          publishing: 'profile',
          profileAst: validProfileDocument,
          mapAst: {} as MapDocumentNode,
          providerJson: validProviderSource,
          profileFrom: mockProfileFrom,
          providerFrom: mockProviderFrom,
          mapFrom: mockMapFrom,
          superJson: mockSuperJson,
        })
      ).toThrow(
        new CLIError(
          `Map AST validation failed at $: expected 'astMetadata' in object, found: {}`
        )
      );
    });

    it('returns empty array on valid documents', async () => {
      expect(
        prePublishCheck({
          publishing: 'profile',
          profileAst: validProfileDocument,
          mapAst: validMapDocument,
          providerJson: validProviderSource,
          profileFrom: mockProfileFrom,
          providerFrom: mockProviderFrom,
          mapFrom: mockMapFrom,
          superJson: mockSuperJson,
        })
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
        prePublishCheck({
          publishing: 'profile',
          profileAst: invalidProfileDocument,
          mapAst: validMapDocument,
          providerJson: validProviderSource,
          profileFrom: mockProfileFrom,
          providerFrom: mockProviderFrom,
          mapFrom: mockMapFrom,
          superJson: mockSuperJson,
        })
          .flatMap(checkResult => checkResult.issues)
          .filter(err => err.kind === 'error').length
      ).toBeGreaterThan(0);
    });

    it('returns array with warnings on invalid profile', async () => {
      expect(
        prePublishCheck({
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
        })
          .flatMap(checkResult => checkResult.issues)
          .filter(err => err.kind === 'warn').length
      ).toBeGreaterThan(0);
    });

    it('returns array with errors on invalid map', async () => {
      expect(
        prePublishCheck({
          publishing: 'map',
          profileAst: invalidProfileDocument,
          mapAst: invalidMapDocument,
          providerJson: validProviderSource,
          profileFrom: mockProfileFrom,
          providerFrom: mockProviderFrom,
          mapFrom: mockMapFrom,
          superJson: mockSuperJson,
        })
          .flatMap(checkResult => checkResult.issues)
          .filter(err => err.kind === 'error').length
      ).toBeGreaterThan(0);
    });

    it('returns array with warnings on invalid map', async () => {
      expect(
        prePublishCheck({
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
        })
          .flatMap(checkResult => checkResult.issues)
          .filter(err => err.kind === 'warn').length
      ).toBeGreaterThan(0);
    });

    it('returns array with errors on invalid provider', async () => {
      expect(
        prePublishCheck({
          publishing: 'provider',
          profileAst: validProfileDocument,
          mapAst: validMapDocument,
          providerJson: invalidProviderSource,
          profileFrom: mockProfileFrom,
          providerFrom: mockProviderFrom,
          mapFrom: mockMapFrom,
          superJson: mockSuperJson,
        })
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
      mocked(findLocalProfileSource).mockResolvedValue({
        source: mockProfileSource,
        path: 'mock profile path',
      });
      const parseProfileSpy = jest
        .spyOn(Parser, 'parseProfile')
        .mockResolvedValue(validProfileDocument);

      await expect(
        loadProfile(mockSuperJson, mockProfile, undefined, { logCb: mockLogCb })
      ).resolves.toEqual({
        ast: validProfileDocument,
        from: {
          kind: 'local',
          source: mockProfileSource,
          path: 'mock profile path',
        },
      });

      expect(parseProfileSpy).toHaveBeenCalledWith(
        mockProfileSource,
        mockProfile.id,
        {
          profileName: mockProfile.name,
          scope: mockProfile.scope,
        }
      );
      expect(mockLogCb).toHaveBeenCalledWith(
        `Profile: "${mockProfile.id}" found on local file system at path: "mock profile path"`
      );
    });

    it('loads AST from store', async () => {
      mocked(findLocalProfileSource).mockResolvedValue(undefined);
      mocked(fetchProfileAST).mockResolvedValue(validProfileDocument);
      const parseProfileSpy = jest.spyOn(Parser, 'parseProfile');

      await expect(
        loadProfile(mockSuperJson, mockProfile, undefined, { logCb: mockLogCb })
      ).resolves.toEqual({
        ast: validProfileDocument,
        from: {
          kind: 'remote',
          version: '1.0.0',
        },
      });

      expect(parseProfileSpy).not.toHaveBeenCalled();
      expect(fetchProfileAST).toHaveBeenCalledWith(mockProfile.id);
      expect(mockLogCb).toHaveBeenCalledWith(
        `Loading profile: "${mockProfile.id}" in version: "1.0.0" from Superface store`
      );
    });
  });

  describe('when loading map', () => {
    it('loads local map source and parses it to AST', async () => {
      mocked(findLocalMapSource).mockResolvedValue({
        source: mockMapSource,
        path: 'mock map path',
      });
      const parseMapSpy = jest
        .spyOn(Parser, 'parseMap')
        .mockResolvedValue(validMapDocument);

      await expect(
        loadMap(mockSuperJson, mockProfile, mockProviderName, {}, undefined, {
          logCb: mockLogCb,
        })
      ).resolves.toEqual({
        ast: validMapDocument,
        from: {
          kind: 'local',
          source: mockMapSource,
          path: 'mock map path',
        },
      });

      expect(parseMapSpy).toHaveBeenCalledWith(
        mockMapSource,
        `${mockProfile.name}.${mockProviderName}`,
        {
          profileName: mockProfile.name,
          scope: mockProfile.scope,
          providerName: mockProviderName,
        }
      );

      expect(mockLogCb).toHaveBeenCalledWith(
        `Map for profile: "${mockProfile.id}" and provider: "${mockProviderName}" found on local filesystem at path: "mock map path"`
      );
    });

    it('loads AST from store', async () => {
      mocked(findLocalMapSource).mockResolvedValue(undefined);
      mocked(fetchMapAST).mockResolvedValue(validMapDocument);
      const parseMapSpy = jest.spyOn(Parser, 'parseMap');

      await expect(
        loadMap(mockSuperJson, mockProfile, mockProviderName, {}, undefined, {
          logCb: mockLogCb,
        })
      ).resolves.toEqual({
        ast: validMapDocument,
        from: {
          kind: 'remote',
          version: '1.0.0',
        },
      });

      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(fetchMapAST).toHaveBeenCalledWith(
        mockProfile.name,
        mockProviderName,
        mockProfile.scope,
        undefined,
        undefined
      );

      expect(mockLogCb).toHaveBeenCalledWith(
        `Loading map for profile: "${mockProfile.id}" and provider: "${mockProviderName}" in version: "1.0.0" from Superface store`
      );
    });
  });

  describe('when loading provider', () => {
    it('loads local provider source', async () => {
      mocked(findLocalProviderSource).mockResolvedValue({
        source: validProviderSource,
        path: 'mock provider path',
      });

      await expect(
        loadProvider(mockSuperJson, mockProviderName, { logCb: mockLogCb })
      ).resolves.toEqual({
        source: validProviderSource,
        from: {
          kind: 'local',
          path: 'mock provider path',
        },
      });
      expect(mockLogCb).toHaveBeenCalledWith(
        `Provider: "${mockProviderName}" found on local file system at path: "mock provider path"`
      );
    });

    it('loads provider json from store', async () => {
      mocked(findLocalProviderSource).mockResolvedValue(undefined);
      mocked(fetchProviderInfo).mockResolvedValue(validProviderSource);

      await expect(
        loadProvider(mockSuperJson, mockProviderName, { logCb: mockLogCb })
      ).resolves.toEqual({
        source: validProviderSource,
        from: {
          kind: 'remote',
        },
      });

      expect(fetchProviderInfo).toHaveBeenCalledWith(mockProviderName);
      expect(mockLogCb).toHaveBeenCalledWith(
        `Loading provider: "${mockProviderName}" from Superface store`
      );
    });
  });
});
