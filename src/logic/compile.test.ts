import { parseMap, parseProfile, Source } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import { MockLogger } from '..';
import { createUserError } from '../common/error';
import { exists, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { mockMapDocumentNode } from '../test/map-document-node';
import { mockProfileDocumentNode } from '../test/profile-document-node';
import { compile, ProfileToCompile } from './compile';

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

    const profiles: ProfileToCompile[] = [
      {
        path: 'first/profile.supr',
        id: ProfileId.fromScopeName('first', 'profile'),
        maps: [
          { path: 'first/profile/first/map.suma', provider: 'first' },
          { path: 'first/profile/second/map.suma', provider: 'second' },
        ],
      },
      {
        path: 'second/profile.supr',
        id: ProfileId.fromScopeName('second', 'profile'),
        maps: [
          { path: 'second/profile/first/map.suma', provider: 'first' },
          { path: 'second/profile/second/map.suma', provider: 'second' },
        ],
      },
      {
        path: 'third/profile.supr.ast.json',
        id: ProfileId.fromScopeName('third', 'profile'),
        maps: [
          { path: 'third/profile/first/map.suma.ast.json', provider: 'first' },
        ],
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
        compile({ profiles }, { logger, userError })
      ).resolves.toBeUndefined();
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        1,
        new Source(mockProfileContent, profiles[0].path)
      );
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        2,
        new Source(mockProfileContent, profiles[1].path)
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
        new Source(mockMapContent, profiles[0].maps[0].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        2,
        new Source(mockMapContent, profiles[0].maps[1].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        3,
        new Source(mockMapContent, profiles[1].maps[0].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        4,
        new Source(mockMapContent, profiles[1].maps[1].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        5,
        new Source(mockMapContent, profiles[2].maps[0].path)
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
    });

    it('compiles only maps', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockImplementation(path => {
        if (path.toString().endsWith('.suma')) {
          return Promise.resolve(mockMapContent);
        }

        return Promise.resolve(mockProfileContent);
      });

      await expect(
        compile({ profiles, options: { onlyMap: true } }, { logger, userError })
      ).resolves.toBeUndefined();
      expect(parseProfileSpy).not.toHaveBeenCalled();

      expect(parseMapSpy).toHaveBeenNthCalledWith(
        1,
        new Source(mockMapContent, profiles[0].maps[0].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        2,
        new Source(mockMapContent, profiles[0].maps[1].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        3,
        new Source(mockMapContent, profiles[1].maps[0].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        4,
        new Source(mockMapContent, profiles[1].maps[1].path)
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        5,
        new Source(mockMapContent, profiles[2].maps[0].path)
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
    });

    it('compiles only profiles', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockImplementation(path => {
        if (path.toString().endsWith('.suma')) {
          return Promise.resolve(mockMapContent);
        }

        return Promise.resolve(mockProfileContent);
      });

      await expect(
        compile(
          { profiles, options: { onlyProfile: true } },
          { logger, userError }
        )
      ).resolves.toBeUndefined();
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        1,
        new Source(mockProfileContent, profiles[0].path)
      );
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        2,
        new Source(mockProfileContent, profiles[1].path)
      );
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        3,
        new Source(
          mockProfileContent,
          // reads source
          'third/profile.supr'
        )
      );

      expect(parseMapSpy).not.toHaveBeenCalled();
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
    });

    it('throws on profile file with unsupported extension', async () => {
      mocked(exists).mockResolvedValue(false);

      await expect(
        compile(
          {
            profiles: [
              {
                path: 'profile.ts',
                id: ProfileId.fromScopeName('first', 'profile'),
                maps: [],
              },
            ],
          },
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

      await expect(
        compile({ profiles }, { logger, userError })
      ).rejects.toThrow(
        'Path: "first/profile.supr" for profile first/profile does not exist'
      );
      expect(parseProfileSpy).not.toHaveBeenCalled();

      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(writeOnceSpy).not.toHaveBeenCalled();
    });

    it('throws on map file with unsupported extension', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockImplementation(() => {
        return Promise.resolve(mockProfileContent);
      });

      await expect(
        compile(
          {
            profiles: [
              {
                path: 'profile.supr',
                id: ProfileId.fromScopeName('first', 'profile'),
                maps: [{ path: 'profile/first/map.ts', provider: 'first' }],
              },
            ],
          },
          { logger, userError }
        )
      ).rejects.toThrow(
        'Path: "profile/first/map.ts" uses unsupported extension. Please use file with ".suma" extension.'
      );
      expect(parseProfileSpy).toHaveBeenCalledWith(
        new Source(mockProfileContent, 'profile.supr')
      );
      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('throws when map file does not exist', async () => {
      mocked(exists).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      mocked(readFile).mockImplementation(path => {
        if (path.toString().endsWith('.suma')) {
          return Promise.resolve(mockMapContent);
        }

        return Promise.resolve(mockProfileContent);
      });

      await expect(
        compile({ profiles }, { logger, userError })
      ).rejects.toThrow(
        'Path: "first/profile/first/map.suma" for map first/profile.first does not exist'
      );
      expect(parseProfileSpy).toHaveBeenCalledWith(
        new Source(mockProfileContent, profiles[0].path)
      );

      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });
  });
});
