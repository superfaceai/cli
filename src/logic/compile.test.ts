import { Parser } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { MockLogger } from '..';
import { createUserError } from '../common/error';
import { exists, readFile } from '../common/io';
import { ProfileId } from '../common/profile';
import { compile, ProfileToCompile } from './compile';

jest.mock('../common/io', () => ({
  readFile: jest.fn(),
  exists: jest.fn(),
}));
jest.mock('@superfaceai/one-sdk/dist/internal/parser');

describe('Compile CLI logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);

  beforeEach(() => {
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
    ];

    it('compiles maps and profiles', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockImplementation(path => {
        if (path.toString().endsWith('.suma')) {
          return Promise.resolve(mockMapContent);
        }

        return Promise.resolve(mockProfileContent);
      });
      const clearCacheSpy = jest.spyOn(Parser, 'clearCache');
      const parseMapSpy = jest.spyOn(Parser, 'parseMap');
      const parseProfileSpy = jest.spyOn(Parser, 'parseProfile');

      await expect(
        compile({ profiles }, { logger, userError })
      ).resolves.toBeUndefined();
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        1,
        mockProfileContent,
        profiles[0].path,
        { profileName: 'profile', scope: 'first' }
      );
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        2,
        mockProfileContent,
        profiles[1].path,
        { profileName: 'profile', scope: 'second' }
      );

      expect(parseMapSpy).toHaveBeenNthCalledWith(
        1,
        mockMapContent,
        profiles[0].maps[0].path,
        { profileName: 'profile', scope: 'first', providerName: 'first' }
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        2,
        mockMapContent,
        profiles[0].maps[1].path,
        { profileName: 'profile', scope: 'first', providerName: 'second' }
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        3,
        mockMapContent,
        profiles[1].maps[0].path,
        { profileName: 'profile', scope: 'second', providerName: 'first' }
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        4,
        mockMapContent,
        profiles[1].maps[1].path,
        { profileName: 'profile', scope: 'second', providerName: 'second' }
      );
      expect(clearCacheSpy).toHaveBeenCalled();
    });

    it('compiles only maps', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockImplementation(path => {
        if (path.toString().endsWith('.suma')) {
          return Promise.resolve(mockMapContent);
        }

        return Promise.resolve(mockProfileContent);
      });
      const clearCacheSpy = jest.spyOn(Parser, 'clearCache');
      const parseMapSpy = jest.spyOn(Parser, 'parseMap');
      const parseProfileSpy = jest.spyOn(Parser, 'parseProfile');

      await expect(
        compile({ profiles, options: { onlyMap: true } }, { logger, userError })
      ).resolves.toBeUndefined();
      expect(parseProfileSpy).not.toHaveBeenCalled();

      expect(parseMapSpy).toHaveBeenNthCalledWith(
        1,
        mockMapContent,
        profiles[0].maps[0].path,
        { profileName: 'profile', scope: 'first', providerName: 'first' }
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        2,
        mockMapContent,
        profiles[0].maps[1].path,
        { profileName: 'profile', scope: 'first', providerName: 'second' }
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        3,
        mockMapContent,
        profiles[1].maps[0].path,
        { profileName: 'profile', scope: 'second', providerName: 'first' }
      );
      expect(parseMapSpy).toHaveBeenNthCalledWith(
        4,
        mockMapContent,
        profiles[1].maps[1].path,
        { profileName: 'profile', scope: 'second', providerName: 'second' }
      );
      expect(clearCacheSpy).toHaveBeenCalled();
    });

    it('compiles only profiles', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockImplementation(path => {
        if (path.toString().endsWith('.suma')) {
          return Promise.resolve(mockMapContent);
        }

        return Promise.resolve(mockProfileContent);
      });
      const clearCacheSpy = jest.spyOn(Parser, 'clearCache');
      const parseMapSpy = jest.spyOn(Parser, 'parseMap');
      const parseProfileSpy = jest.spyOn(Parser, 'parseProfile');

      await expect(
        compile(
          { profiles, options: { onlyProfile: true } },
          { logger, userError }
        )
      ).resolves.toBeUndefined();
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        1,
        mockProfileContent,
        profiles[0].path,
        { profileName: 'profile', scope: 'first' }
      );
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        2,
        mockProfileContent,
        profiles[1].path,
        { profileName: 'profile', scope: 'second' }
      );

      expect(clearCacheSpy).toHaveBeenCalled();
      expect(parseMapSpy).not.toHaveBeenCalled();
    });

    it('throws when profile file does not exist', async () => {
      mocked(exists).mockResolvedValue(false);
      const parseMapSpy = jest.spyOn(Parser, 'parseMap');
      const parseProfileSpy = jest.spyOn(Parser, 'parseProfile');
      const clearCacheSpy = jest.spyOn(Parser, 'clearCache');

      await expect(
        compile({ profiles }, { logger, userError })
      ).rejects.toThrow(
        'Path: "first/profile.supr" for profile first/profile does not exist'
      );
      expect(parseProfileSpy).not.toHaveBeenCalled();

      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(clearCacheSpy).toHaveBeenCalled();
    });

    it('throws when map file does not exist', async () => {
      mocked(exists).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const parseMapSpy = jest.spyOn(Parser, 'parseMap');
      const parseProfileSpy = jest.spyOn(Parser, 'parseProfile');
      const clearCacheSpy = jest.spyOn(Parser, 'clearCache');
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
      expect(parseProfileSpy).toHaveBeenNthCalledWith(
        1,
        mockProfileContent,
        profiles[0].path,
        { profileName: 'profile', scope: 'first' }
      );

      expect(parseMapSpy).not.toHaveBeenCalled();
      expect(clearCacheSpy).toHaveBeenCalled();
    });
  });
});
