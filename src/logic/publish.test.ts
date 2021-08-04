import { CLIError } from '@oclif/errors';
import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import { parseMap, parseProfile } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import { exists, readFile } from '../common/io';
import { publish } from './publish';

//Mock io
jest.mock('../common/io', () => ({
  exists: jest.fn(),
  readFile: jest.fn(),
}));

//Mock parser
jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual<Record<string, unknown>>('@superfaceai/parser'),
  parseMap: jest.fn(),
  parseProfile: jest.fn(),
}));

describe('Publish logic', () => {
  describe('when publishing', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('throws when path does not exist', async () => {
      const mockPath = '/test/path.suma';
      mocked(exists).mockResolvedValue(false);
      await expect(publish(mockPath)).rejects.toEqual(
        new CLIError('Path does not exist')
      );
    });

    it('throws when path has ast.json extension', async () => {
      mocked(exists).mockResolvedValue(true);
      await expect(publish('/test/test.suma.ast.json')).rejects.toEqual(
        new CLIError('Do not use compiled files! Use .supr or .suma files')
      );
      await expect(publish('/test/test.supr.ast.json')).rejects.toEqual(
        new CLIError('Do not use compiled files! Use .supr or .suma files')
      );
    });

    it('throws when path has unknown extension', async () => {
      const mockContent = 'someContent';
      const moskPath = '/test/path.stp';
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockContent);
      await expect(publish(moskPath)).rejects.toEqual(
        new CLIError('Unknown file suffix')
      );
    });

    it('throws when loaded file has not provider json structure', async () => {
      const mockContent = JSON.stringify({ test: 'test' });
      const moskPath = '/test/path.json';
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockContent);
      await expect(publish(moskPath)).rejects.toEqual(
        new CLIError('File does not have provider json structure')
      );
    });

    it('throws when loaded file has not profile document node structure', async () => {
      const mockProfileDocument = {
        kind: '',
        header: {
          extra: 'extra',
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
      const mockContent = '';
      const moskPath = '/test/path.supr';
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseProfile).mockReturnValue(
        mockProfileDocument as ProfileDocumentNode
      );
      await expect(publish(moskPath)).rejects.toEqual(
        new CLIError('Unknown profile file structure')
      );
    });

    it('throws when loaded file has not map document node structure', async () => {
      const mockMapDocument = {
        kind: '',
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
      const mockContent = '';
      const moskPath = '/test/path.suma';
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseMap).mockReturnValue(mockMapDocument as MapDocumentNode);
      await expect(publish(moskPath)).rejects.toEqual(
        new CLIError('Unknown map file structure')
      );
    });
  });
});
