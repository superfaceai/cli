import { CLIError } from '@oclif/errors';
import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import { Parser, SuperJson } from '@superfaceai/one-sdk';
import { ProfileId } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import { fetchMapAST, fetchProfileAST } from '../common/http';
import { ProfileMapReport } from '../common/report.interfaces';
import { findLocalMapSource, findLocalProfileSource } from './check.utils';
import {
  loadMap,
  loadProfile,
  prePublishCheck,
  prePublishLint,
} from './publish.utils';

//Mock check util
jest.mock('./check.utils', () => ({
  ...jest.requireActual<Record<string, unknown>>('./check.utils'),
  findLocalProfileSource: jest.fn(),
  findLocalMapSource: jest.fn(),
}));

//Mock http
jest.mock('../common/http', () => ({
  fetchProfileAST: jest.fn(),
  fetchMapAST: jest.fn(),
}));

describe('Publish logic utils', () => {
  const mockProfileId = 'starwars/character-information';
  const mockProfile = ProfileId.fromId(mockProfileId);
  const mockProviderName = 'unverified-swapi';
  const validProfileDocument: ProfileDocumentNode = {
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
  const mockSuperJson = new SuperJson();

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running pre publish check', () => {
    it('throws error on invalid profile document structure', async () => {
      expect(() =>
        prePublishCheck(
          'profile',
          {} as ProfileDocumentNode,
          validMapDocument,
          validProviderSource
        )
      ).toThrow(
        new CLIError(
          `validation failed at $: expected 'kind' in object, found: {}`
        )
      );
    });

    it('throws error on invalid map document structure', async () => {
      expect(() =>
        prePublishCheck(
          'profile',
          validProfileDocument,
          {} as MapDocumentNode,
          validProviderSource
        )
      ).toThrow(
        new CLIError(
          `validation failed at $: expected 'kind' in object, found: {}`
        )
      );
    });

    it('returns empty array on valid documents', async () => {
      expect(
        prePublishCheck(
          'profile',
          validProfileDocument,
          validMapDocument,
          validProviderSource
        )
      ).toEqual([]);
    });

    it('returns array with errors on invalid profile', async () => {
      expect(
        prePublishCheck(
          'profile',
          invalidProfileDocument,
          validMapDocument,
          validProviderSource
        ).filter(err => err.kind === 'error').length
      ).toBeGreaterThan(0);
    });

    it('returns array with warnings on invalid profile', async () => {
      expect(
        prePublishCheck(
          'provider',
          invalidProfileDocument,
          {
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
          validProviderSource
        ).filter(err => err.kind === 'warn').length
      ).toBeGreaterThan(0);
    });

    it('returns array with errors on invalid map', async () => {
      expect(
        prePublishCheck(
          'map',
          invalidProfileDocument,
          invalidMapDocument,
          validProviderSource
        ).filter(err => err.kind === 'error').length
      ).toBeGreaterThan(0);
    });

    it('returns array with warnings on invalid map', async () => {
      expect(
        prePublishCheck(
          'provider',
          invalidProfileDocument,
          {
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
          validProviderSource
        ).filter(err => err.kind === 'warn').length
      ).toBeGreaterThan(0);
    });

    it('returns array with errors on invalid provider', async () => {
      expect(
        prePublishCheck(
          'provider',
          validProfileDocument,
          validMapDocument,
          invalidProviderSource
        ).filter(err => err.kind === 'error').length
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
      mocked(findLocalProfileSource).mockResolvedValue(mockProfileSource);
      const parseProfileSpy = jest
        .spyOn(Parser, 'parseProfile')
        .mockResolvedValue(validProfileDocument);

      await expect(loadProfile(mockSuperJson, mockProfile)).resolves.toEqual({
        ast: validProfileDocument,
        source: mockProfileSource,
      });

      expect(parseProfileSpy).toHaveBeenCalledWith(
        mockProfileSource,
        mockProfile.withoutVersion,
        {
          profileName: mockProfile.name,
          scope: mockProfile.scope,
        }
      );
    });

    it('loads AST from store', async () => {
      mocked(findLocalProfileSource).mockResolvedValue(undefined);
      mocked(fetchProfileAST).mockResolvedValue(validProfileDocument);
      const parseProfileSpy = jest.spyOn(Parser, 'parseProfile');

      await expect(loadProfile(mockSuperJson, mockProfile)).resolves.toEqual({
        ast: validProfileDocument,
      });

      expect(parseProfileSpy).not.toHaveBeenCalled();
      expect(fetchProfileAST).toHaveBeenCalledWith(mockProfile);
    });
  });

  describe('when loading map', () => {
    it('loads local map source and parses it to AST', async () => {
      mocked(findLocalMapSource).mockResolvedValue(mockMapSource);
      const parseMapSpy = jest
        .spyOn(Parser, 'parseMap')
        .mockResolvedValue(validMapDocument);

      await expect(
        loadMap(mockSuperJson, mockProfile, mockProviderName, {})
      ).resolves.toEqual({ ast: validMapDocument, source: mockMapSource });

      expect(parseMapSpy).toHaveBeenCalledWith(
        mockMapSource,
        `${mockProfile.name}.${mockProviderName}`,
        {
          profileName: mockProfile.name,
          scope: mockProfile.scope,
          providerName: mockProviderName,
        }
      );
    });

    it('loads AST from store', async () => {
      mocked(findLocalMapSource).mockResolvedValue(undefined);
      mocked(fetchMapAST).mockResolvedValue(validMapDocument);
      const parseMapSpy = jest.spyOn(Parser, 'parseMap');

      await expect(
        loadMap(mockSuperJson, mockProfile, mockProviderName, {})
      ).resolves.toEqual({ ast: validMapDocument });

      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(fetchMapAST).toHaveBeenCalledWith(
        mockProfile.name,
        mockProviderName,
        mockProfile.scope,
        undefined,
        undefined
      );
    });
  });
});
