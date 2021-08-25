import { CLIError } from '@oclif/errors';
import { DocumentType, ProfileDocumentNode } from '@superfaceai/ast';
import { parseProfile, parseProfileId } from '@superfaceai/parser';
import * as fs from 'fs';
import { mocked } from 'ts-jest/utils';

import {
  composeUsecaseName,
  composeVersion,
  constructProfileProviderSettings,
  constructProfileSettings,
  constructProviderSettings,
  findLocalCapabilities,
  inferCreateMode,
  inferDocumentTypeWithFlag,
  parseProfileDocument,
  trimExtension,
} from './document';
import { readdir, readFile } from './io';

//Mock parser
jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual<Record<string, unknown>>('@superfaceai/parser'),
  parseProfile: jest.fn(),
  parseProfileId: jest.fn(),
}));

//Mock io
jest.mock('./io', () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
}));

describe('Document functions', () => {
  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe('when infering document type with flag', () => {
    it('infers document type correctly', async () => {
      expect(inferDocumentTypeWithFlag('map')).toEqual(DocumentType.MAP);
      expect(inferDocumentTypeWithFlag('profile')).toEqual(
        DocumentType.PROFILE
      );
      expect(inferDocumentTypeWithFlag('auto')).toEqual(DocumentType.UNKNOWN);
      expect(inferDocumentTypeWithFlag('auto', 'TesT.suma.ast.json ')).toEqual(
        DocumentType.MAP_AST
      );
      expect(inferDocumentTypeWithFlag('auto', 'TesT.supr.ast.json ')).toEqual(
        DocumentType.PROFILE_AST
      );
    });
  });

  describe('when infering create mode', () => {
    it('infers create mode correctly', async () => {
      expect(inferCreateMode('map')).toEqual(DocumentType.MAP);
      expect(inferCreateMode('profile')).toEqual(DocumentType.PROFILE);
      expect(inferCreateMode('json')).toEqual(DocumentType.UNKNOWN);
    });
  });

  describe('when composing version', () => {
    it('composes version correctly', async () => {
      expect(
        composeVersion({ major: 1, minor: 1, patch: 1, label: 'fix' })
      ).toEqual('1.1.1-fix');
      expect(
        composeVersion({ major: 1, minor: 1, patch: 1, label: 'fix' }, true)
      ).toEqual('1.1-fix');
    });
  });

  describe('when composing usecase name', () => {
    it('composes usecase name correctly', async () => {
      expect(composeUsecaseName('test-name')).toEqual('TestName');
      expect(composeUsecaseName('test_name')).toEqual('TestName');
    });
  });

  describe('when geting profile document', () => {
    it('gets document correctly', async () => {
      const mockProfileDocumentNode: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: {
          kind: 'ProfileHeader',
          scope: 'starwars',
          name: 'character-information',
          version: { major: 1, minor: 0, patch: 1 },
          location: { line: 1, column: 1 },
          span: { start: 0, end: 57 },
        },
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'RetrieveCharacterInformation',
            safety: 'safe',
            title: 'Starwars',
          },
        ],
        location: { line: 1, column: 1 },
        span: { start: 0, end: 228 },
      };
      mocked(readFile).mockResolvedValue('test-file-content');
      mocked(parseProfile).mockReturnValue(mockProfileDocumentNode);

      await expect(parseProfileDocument('test-path')).resolves.toEqual(
        mockProfileDocumentNode
      );
      expect(readFile).toHaveBeenCalledTimes(1);
      expect(readFile).toHaveBeenCalledWith('test-path', { encoding: 'utf-8' });
    });
  });

  describe('when triming extension', () => {
    it('trims extension correctly', async () => {
      expect(trimExtension('test.suma')).toEqual('test');
      expect(trimExtension('test.supr')).toEqual('test');
      expect(trimExtension('test.suma.ast.json')).toEqual('test');
      expect(trimExtension('test.supr.ast.json')).toEqual('test');
      expect(() => trimExtension('test.json')).toThrow(
        new CLIError('Could not infer document type')
      );
    });
  });

  describe('when finding local capabilities', () => {
    const mockProfileDocumentNode: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      header: {
        kind: 'ProfileHeader',
        scope: 'starwars',
        name: 'character-information',
        version: { major: 1, minor: 0, patch: 1 },
        location: { line: 1, column: 1 },
        span: { start: 0, end: 57 },
      },
      definitions: [
        {
          kind: 'UseCaseDefinition',
          useCaseName: 'RetrieveCharacterInformation',
          safety: 'safe',
          title: 'Starwars',
        },
      ],
      location: { line: 1, column: 1 },
      span: { start: 0, end: 228 },
    };

    it('finds local capabilities without version correctly', async () => {
      mocked(readFile).mockResolvedValue('test-file-content');
      mocked(parseProfile).mockReturnValue(mockProfileDocumentNode);

      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'test-map-file.suma',
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'test-profile-file.supr',
        },
      ];
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(findLocalCapabilities('test-path', 'map')).resolves.toEqual([
        'test-map-file',
      ]);
      await expect(
        findLocalCapabilities('test-path', 'profile')
      ).resolves.toEqual(['test-profile-file']);
      expect(readFile).toHaveBeenCalledTimes(2);
      expect(readFile).toHaveBeenNthCalledWith(
        1,
        'test-path/test-map-file.suma',
        { encoding: 'utf-8' }
      );
      expect(readFile).toHaveBeenNthCalledWith(
        2,
        'test-path/test-profile-file.supr',
        { encoding: 'utf-8' }
      );
    });

    it('finds local capabilities with version correctly', async () => {
      mocked(readFile).mockResolvedValue('test-file-content');
      mocked(parseProfile).mockReturnValue(mockProfileDocumentNode);

      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'test-map-file.suma',
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'test-profile-file.supr',
        },
      ];
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalCapabilities('test-path', 'map', true)
      ).resolves.toEqual(['test-map-file@1.0.1']);
      await expect(
        findLocalCapabilities('test-path', 'profile', true)
      ).resolves.toEqual(['test-profile-file@1.0.1']);
      expect(readFile).toHaveBeenCalledTimes(2);
      expect(readFile).toHaveBeenNthCalledWith(
        1,
        'test-path/test-map-file.suma',
        { encoding: 'utf-8' }
      );
      expect(readFile).toHaveBeenNthCalledWith(
        2,
        'test-path/test-profile-file.supr',
        { encoding: 'utf-8' }
      );
    });

    it('finds local capabilities with version in directory correctly', async () => {
      mocked(readFile).mockResolvedValue('test-file-content');
      mocked(parseProfile).mockReturnValue(mockProfileDocumentNode);
      const mockDirs: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => true,
          isFIFO: () => false,
          isFile: () => false,
          isSocket: () => false,
          name: 'directory',
        },
      ];
      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'test-map-file.suma',
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'test-profile-file.supr',
        },
      ];
      mocked(readdir)
        .mockResolvedValueOnce(mockDirs)
        .mockResolvedValueOnce(mockFiles)
        .mockResolvedValueOnce(mockDirs)
        .mockResolvedValueOnce(mockFiles);

      await expect(
        findLocalCapabilities('test-path', 'map', true)
      ).resolves.toEqual(['directory/test-map-file@1.0.1']);
      await expect(
        findLocalCapabilities('test-path', 'profile', true)
      ).resolves.toEqual(['directory/test-profile-file@1.0.1']);

      expect(readFile).toHaveBeenCalledTimes(2);
      expect(readFile).toHaveBeenNthCalledWith(
        1,
        'test-path/directory/test-map-file.suma',
        { encoding: 'utf-8' }
      );
      expect(readFile).toHaveBeenNthCalledWith(
        2,
        'test-path/directory/test-profile-file.supr',
        { encoding: 'utf-8' }
      );
    });
  });

  describe('when constructing profile settings', () => {
    it('constructs profile settings correctly', async () => {
      mocked(parseProfileId)
        .mockReturnValueOnce({
          kind: 'parsed',
          value: {
            name: 'first',
            version: { major: 1 },
          },
        })
        .mockReturnValueOnce({
          kind: 'parsed',
          value: {
            name: 'second',
            version: { major: 2 },
          },
        });
      expect(constructProfileSettings(['first', 'second'])).toEqual({
        first: {
          version: '1.0.0',
          file: 'grid/first.supr',
        },
        second: {
          version: '2.0.0',
          file: 'grid/second.supr',
        },
      });
    });

    it('throws error for error kind', async () => {
      mocked(parseProfileId).mockReturnValueOnce({
        kind: 'error',
        message: 'test err',
      });
      expect(() => constructProfileSettings(['first'])).toThrow(
        new CLIError('Wrong profile Id')
      );
    });
  });

  describe('when constructing profile provider settings', () => {
    it('constructs profile provider settings correctly', async () => {
      expect(constructProfileProviderSettings(['first', 'second'])).toEqual({
        first: {},
        second: {},
      });
    });
  });

  describe('when constructing provider settings', () => {
    it('constructs provider settings correctly', async () => {
      expect(constructProviderSettings(['first', 'second'])).toEqual({
        first: {},
        second: {},
      });
    });
  });
});
