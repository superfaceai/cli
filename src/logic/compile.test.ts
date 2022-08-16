import {
  parseMap,
  parseProfile,
  Source,
  SyntaxError,
} from '@superfaceai/parser';
import { SyntaxErrorCategory } from '@superfaceai/parser/dist/language/error';
import { mocked } from 'ts-jest/utils';

import { MockLogger } from '..';
import { createUserError } from '../common/error';
import { exists, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { mockMapDocumentNode } from '../test/map-document-node';
import { mockProfileDocumentNode } from '../test/profile-document-node';
import { compile, FileToCompile } from './compile';

jest.mock('../common/io', () => ({
  readFile: jest.fn(),
  exists: jest.fn(),
}));
jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual('@superfaceai/parser'),
  parseProfile: jest.fn(),
  parseMap: jest.fn(),
}));
describe('Compile CLI logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);
  const mockProfile = mockProfileDocumentNode();
  const mockMap = mockMapDocumentNode();

  const mockSyntaxError = (content: string) =>
    new SyntaxError(
      new Source(content),
      {
        start: {
          line: 0,
          column: 0,
          charIndex: 0,
        },
        end: {
          line: 0,
          column: 0,
          charIndex: 0,
        },
      },
      SyntaxErrorCategory.PARSER
    );

  const writeOnceSpy = jest.spyOn(OutputStream, 'writeOnce');
  const parseMapSpy = mocked(parseMap);
  const parseProfileSpy = mocked(parseProfile);

  beforeEach(() => {
    writeOnceSpy.mockResolvedValue(undefined);
    parseMapSpy.mockReturnValue(mockMap);
    parseProfileSpy.mockReturnValue(mockProfile);

    logger = new MockLogger();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running compile', () => {
    const mockProfileContent = 'mock-profile-content';
    const mockMapContent = 'mock-map-content';

    const files: FileToCompile[] = [
      {
        path: 'first/profile.supr',
        profileId: ProfileId.fromScopeName('first', 'profile'),
        kind: 'profile',
      },
      {
        profileId: ProfileId.fromScopeName('first', 'profile'),
        kind: 'map',
        path: 'first/profile/first/map.suma',
        provider: 'first',
      },
      {
        profileId: ProfileId.fromScopeName('first', 'profile'),
        kind: 'map',
        path: 'first/profile/second/map.suma',
        provider: 'second',
      },
      {
        path: 'second/profile.supr',
        profileId: ProfileId.fromScopeName('second', 'profile'),
        kind: 'profile',
      },
      {
        path: 'second/profile/first/map.suma',
        provider: 'first',
        profileId: ProfileId.fromScopeName('second', 'profile'),
        kind: 'map',
      },
      {
        path: 'second/profile/second/map.suma',
        provider: 'second',
        profileId: ProfileId.fromScopeName('second', 'profile'),
        kind: 'map',
      },
      {
        path: 'third/profile.supr.ast.json',
        profileId: ProfileId.fromScopeName('third', 'profile'),
        kind: 'profile',
      },
      {
        path: 'third/profile/first/map.suma.ast.json',
        provider: 'first',
        profileId: ProfileId.fromScopeName('third', 'profile'),
        kind: 'map',
      },

      {
        profileId: ProfileId.fromScopeName('remote', 'profile'),
        path: 'remote/profile/first/map.suma.ast.json',
        provider: 'first',
        kind: 'map',
      },
    ];

    it('compiles maps and profiles', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockImplementation(path => {
        if (path.toString().endsWith('.ast.json')) {
          throw new Error('Use of ast.json instead of source');
        }
        if (path.toString().endsWith('.suma')) {
          return Promise.resolve(mockMapContent);
        }

        return Promise.resolve(mockProfileContent);
      });

      await expect(
        compile(files, { logger, userError })
      ).resolves.toBeUndefined();
      expect(parseProfileSpy).toHaveBeenCalledTimes(3);
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        1,
        new Source(mockProfileContent, files[0].path)
      );
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        2,
        new Source(mockProfileContent, files[3].path)
      );
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        3,
        new Source(
          mockProfileContent,
          // reads source
          'third/profile.supr'
        )
      );

      expect(parseMapSpy).toHaveBeenNthCalledWith(
        1,
        new Source(mockMapContent, files[1].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        2,
        new Source(mockMapContent, files[2].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        3,
        new Source(mockMapContent, files[4].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        4,
        new Source(mockMapContent, files[5].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        5,
        new Source(mockMapContent, 'third/profile/first/map.suma')
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        6,
        new Source(mockMapContent, 'remote/profile/first/map.suma')
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'first/profile.supr.ast.json',
        JSON.stringify(mockProfile, undefined, 2)
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'second/profile.supr.ast.json',
        JSON.stringify(mockProfile, undefined, 2)
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'third/profile.supr.ast.json',
        JSON.stringify(mockProfile, undefined, 2)
      );

      expect(writeOnceSpy).toHaveBeenCalledWith(
        'first/profile/first/map.suma.ast.json',
        JSON.stringify(mockMap, undefined, 2)
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'first/profile/second/map.suma.ast.json',
        JSON.stringify(mockMap, undefined, 2)
      );

      expect(writeOnceSpy).toHaveBeenCalledWith(
        'second/profile/first/map.suma.ast.json',
        JSON.stringify(mockMap, undefined, 2)
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'second/profile/second/map.suma.ast.json',
        JSON.stringify(mockMap, undefined, 2)
      );

      expect(writeOnceSpy).toHaveBeenCalledWith(
        'third/profile/first/map.suma.ast.json',
        JSON.stringify(mockMap, undefined, 2)
      );
      expect(writeOnceSpy).toHaveBeenCalledWith(
        'remote/profile/first/map.suma.ast.json',
        JSON.stringify(mockMap, undefined, 2)
      );
    });

    it('throws on profile file with unsupported extension', async () => {
      mocked(exists).mockResolvedValue(false);

      await expect(
        compile(
          [
            {
              path: 'profile.ts',
              profileId: ProfileId.fromScopeName('first', 'profile'),
              kind: 'profile',
            },
          ],
          { logger, userError }
        )
      ).rejects.toThrow(
        'Path: "profile.ts" uses unsupported extension. Please use file with ".supr" extension.'
      );
      expect(parseProfileSpy).not.toHaveBeenCalled();
      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(writeOnceSpy).not.toHaveBeenCalled();
    });

    it('throws when profile file does not exist', async () => {
      mocked(exists).mockResolvedValue(false);

      await expect(compile(files, { logger, userError })).rejects.toThrow(
        'Path: "first/profile.supr" for profile first/profile does not exist'
      );
      expect(parseProfileSpy).not.toHaveBeenCalled();

      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(writeOnceSpy).not.toHaveBeenCalled();
    });

    it('throws on map file with unsupported extension', async () => {
      mocked(exists).mockResolvedValue(false);
      mocked(readFile).mockImplementation(() => {
        return Promise.resolve(mockProfileContent);
      });

      await expect(
        compile(
          [
            {
              profileId: ProfileId.fromScopeName('first', 'profile'),
              path: 'profile/first/map.ts',
              provider: 'first',
              kind: 'map',
            },
          ],
          { logger, userError }
        )
      ).rejects.toThrow(
        'Path: "profile/first/map.ts" uses unsupported extension. Please use file with ".suma" extension.'
      );
      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(writeOnceSpy).not.toHaveBeenCalled();
    });

    it('throws when map file does not exist', async () => {
      mocked(exists).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      mocked(readFile).mockImplementation(path => {
        if (path.toString().endsWith('.suma')) {
          return Promise.resolve(mockMapContent);
        }

        return Promise.resolve(mockProfileContent);
      });

      await expect(compile(files, { logger, userError })).rejects.toThrow(
        'Path: "first/profile/first/map.suma" for map first/profile.first does not exist'
      );
      expect(parseProfileSpy).toHaveBeenCalledWith(
        new Source(mockProfileContent, files[0].path)
      );

      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('logs compilation error', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockImplementation(path => {
        if (path.toString().endsWith('.suma')) {
          return Promise.resolve(mockMapContent);
        }

        return Promise.resolve(mockProfileContent);
      });

      parseMapSpy.mockImplementation(() => {
        throw mockSyntaxError(mockMapContent);
      });

      parseProfileSpy.mockImplementation(() => {
        throw mockSyntaxError(mockProfileContent);
      });

      await expect(
        compile(
          [
            {
              path: 'first/profile.supr',
              profileId: ProfileId.fromScopeName('first', 'profile'),
              kind: 'profile',
            },
            {
              profileId: ProfileId.fromScopeName('first', 'profile'),
              kind: 'map',
              path: 'first/profile/first/map.suma',
              provider: 'first',
            },
          ],
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(parseProfileSpy).toHaveBeenCalledWith(
        new Source(mockProfileContent, 'first/profile.supr')
      );

      expect(parseMapSpy).toHaveBeenCalledWith(
        new Source(mockMapContent, 'first/profile/first/map.suma')
      );
      expect(writeOnceSpy).not.toHaveBeenCalled();
      expect(logger.stderr).toContainEqual([
        'profileCompilationFailed',
        expect.anything(),
      ]);
      expect(logger.stderr).toContainEqual([
        'mapCompilationFailed',
        expect.anything(),
      ]);
    });
  });
});
