import { CLIError } from '@oclif/errors';
import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { fetchMapAST, fetchProfileAST } from '../common/http';
import { Parser } from '../common/parser';
import { ProfileId } from '../common/profile';
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
  const mockProviderName = 'swapi';
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
          {} as ProfileDocumentNode,
          validMapDocument,
          validProviderSource
        )
      ).toThrow(new CLIError(`Profile file has unknown structure`));
    });

    it('throws error on invalid map document structure', async () => {
      expect(() =>
        prePublishCheck(
          validProfileDocument,
          {} as MapDocumentNode,
          validProviderSource
        )
      ).toThrow(new CLIError(`Map file has unknown structure`));
    });

    it('returns empty array on valid documents', async () => {
      expect(
        prePublishCheck(
          validProfileDocument,
          validMapDocument,
          validProviderSource
        )
      ).toEqual([]);
    });

    it('returns not empty array on invalid profile', async () => {
      expect(
        prePublishCheck(
          invalidProfileDocument,
          validMapDocument,
          validProviderSource
        ).length
      ).toBeGreaterThan(0);
    });

    it('returns not empty array on invalid map', async () => {
      expect(
        prePublishCheck(
          invalidProfileDocument,
          invalidMapDocument,
          validProviderSource
        ).length
      ).toBeGreaterThan(0);
    });

    it('returns not empty array on invalid provider', async () => {
      expect(
        prePublishCheck(
          validProfileDocument,
          validMapDocument,
          invalidProviderSource
        ).length
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
        mockProfile.id,
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
      expect(fetchProfileAST).toHaveBeenCalledWith(mockProfile.id);
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
