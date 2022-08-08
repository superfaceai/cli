import {
  ApiKeyPlacement,
  EXTENSIONS,
  HttpScheme,
  ProviderJson,
  SecurityType,
} from '@superfaceai/ast';
import * as fs from 'fs';
import { mocked } from 'ts-jest/utils';

import { DEFAULT_PROFILE_VERSION_STR } from '../common';
import { exists, readdir, readFile } from '../common/io';
import { ProfileId } from '../common/profile';
import {
  findLocalMapSource,
  findLocalProfileSource,
  findLocalProviderSource,
  isProviderParseError,
} from './check.utils';

jest.mock('../common/io');
describe('Check utils', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  const profile = ProfileId.fromScopeName('starwars', 'character-information');
  const version = '1.0.0';
  const provider = 'swapi';
  const mockProfileSource = 'mock profile source';
  const mockMapSource = 'mock map source';

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

  describe('when checking provider parse error', () => {
    it('returns corrrect boolean', () => {
      expect(isProviderParseError({})).toEqual(false);
      expect(isProviderParseError({ path: ['test'] })).toEqual(false);
      expect(
        isProviderParseError({ errors: [{ path: ['test'], message: 'test' }] })
      ).toEqual(true);
      expect(isProviderParseError({ something: 'else' })).toEqual(false);
      expect(
        isProviderParseError({ issues: [{ path: '', message: '' }] })
      ).toEqual(false);
    });
  });

  describe('when looking for local profile source', () => {
    it('returns source if profile with scope and version exists', async () => {
      const mockSuperJson = {};
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        findLocalProfileSource(mockSuperJson, '', profile, version)
      ).resolves.toEqual({
        source: mockProfileSource,
        path: expect.stringContaining(`grid/${profile.id}@${version}`),
      });

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/${profile.id}@${version}`)
      );
    });
    it('returns undefinde if profile with scope and version does nit exist in grid', async () => {
      const mockSuperJson = {};
      mocked(exists).mockResolvedValue(false);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        findLocalProfileSource(mockSuperJson, '', profile, version)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/${profile.id}@${version}`)
      );
    });

    it('returns source if profile with version exists', async () => {
      const mockSuperJson = {};
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        findLocalProfileSource(
          mockSuperJson,
          '',
          ProfileId.fromScopeName(undefined, profile.name),
          version
        )
      ).resolves.toEqual({
        source: mockProfileSource,
        path: expect.stringContaining(`grid/${profile.name}@${version}`),
      });

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/${profile.name}@${version}`)
      );
    });

    it('returns source if profile with scope exists', async () => {
      const mockSuperJson = {};
      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.source}`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.build}`,
        },
      ];
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, '', profile)
      ).resolves.toEqual({
        source: mockProfileSource,
        path: expect.stringContaining(
          `grid/${profile.id}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.source}`
        ),
      });

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining('grid/starwars')
      );
      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/${profile.id}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.source}`
        )
      );
    });

    it('returns source if profile with scope exists - dirent is symbolic link', async () => {
      const mockSuperJson = {};
      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => true,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => false,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.source}`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.build}`,
        },
      ];
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, '', profile)
      ).resolves.toEqual({
        source: mockProfileSource,
        path: expect.stringContaining(
          `grid/${profile.id}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.source}`
        ),
      });

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining('grid/starwars')
      );
      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/${profile.id}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.source}`
        )
      );
    });

    it('returns undefined if profile with scope exists but dirent does not end with source extension', async () => {
      const mockSuperJson = {};
      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => true,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => false,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.build}`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.build}`,
        },
      ];
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, '', profile)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining('grid/starwars')
      );
    });

    it('returns undefined if profile with scope exists but dirent name does not', async () => {
      const mockSuperJson = {};
      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => true,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => false,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.source}`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.build}`,
        },
      ];
      mocked(exists).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, '', profile)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining('grid/starwars')
      );
      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/${profile.id}@${DEFAULT_PROFILE_VERSION_STR}${EXTENSIONS.profile.source}`
        )
      );
    });
    it('returns source if profile with scope and version exists in super json file property', async () => {
      const testPath = `my/beloved/test/path/to/${profile.id}@${version}`;
      const mockSuperJson = {
        profiles: {
          [`${profile.id}`]: {
            file: testPath,
          },
        },
      };
      mocked(exists).mockResolvedValueOnce(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        findLocalProfileSource(mockSuperJson, '', profile)
      ).resolves.toEqual({
        source: mockProfileSource,
        path: expect.stringContaining(testPath),
      });

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(testPath));
    });

    it('returns undefined if profile with scope does not exists in super json file property', async () => {
      const testPath = `my/beloved/test/path/to/${profile.id}`;
      const mockSuperJson = {
        profiles: {
          [`${profile.id}`]: {
            file: testPath,
          },
        },
      };
      mocked(exists).mockResolvedValue(false);
      mocked(readFile).mockResolvedValue('"mockProfileSource"');

      await expect(
        findLocalProfileSource(mockSuperJson, '', profile)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(testPath));
    });
  });

  describe('when looking for local map source', () => {
    it('returns source if file in super.json exists', async () => {
      const testPath = `my/beloved/test/path/to/${provider}.${profile.id}`;
      const mockSuperJson = {
        profiles: {
          [`${profile.id}`]: {
            version,
            providers: {
              [provider]: {
                file: testPath,
              },
            },
          },
        },
      };
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockMapSource);

      await expect(
        findLocalMapSource(mockSuperJson, '', profile, provider)
      ).resolves.toEqual({
        source: mockMapSource,
        path: expect.stringContaining(`${provider}.${profile.id}`),
      });

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`${provider}.${profile.id}`)
      );
    });

    it('returns source if file in super.json exists - profile without scope', async () => {
      const testPath = `my/beloved/test/path/to/${provider}.${profile.id}`;
      const mockSuperJson = {
        profiles: {
          [`${profile.name}`]: {
            version,
            providers: {
              [provider]: {
                file: testPath,
              },
            },
          },
        },
      };
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockMapSource);

      await expect(
        findLocalMapSource(
          mockSuperJson,
          '',
          ProfileId.fromScopeName(undefined, profile.name),
          provider
        )
      ).resolves.toEqual({
        source: mockMapSource,
        path: expect.stringContaining(`${provider}.${profile.id}`),
      });

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`${provider}.${profile.id}`)
      );
    });

    it('returns undefined if file in super.json does not exist', async () => {
      const testPath = `my/beloved/test/path/to/${provider}.${profile.id}`;
      const mockSuperJson = {
        profiles: {
          [`${profile.id}`]: {
            version,
            providers: {
              [provider]: {
                file: testPath,
              },
            },
          },
        },
      };
      mocked(exists).mockResolvedValue(false);

      await expect(
        findLocalMapSource(mockSuperJson, '', profile, provider)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`${provider}.${profile.id}`)
      );
    });

    it('returns undefined if profile does not exist in super.json', async () => {
      const mockSuperJson = {
        profiles: {},
      };
      mocked(exists);

      await expect(
        findLocalMapSource(mockSuperJson, '', profile, provider)
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });

    it('returns undefined if profileProvider does not exist in super.json', async () => {
      const mockSuperJson = {
        profiles: {
          [`${profile.id}`]: {
            version,
            providers: {},
          },
        },
      };
      mocked(exists);

      await expect(
        findLocalMapSource(mockSuperJson, '', profile, provider)
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });

    it('returns undefined if file property  does not exist in profileProvider', async () => {
      const mockSuperJson = {
        profiles: {
          [`${profile.id}`]: {
            version,
            providers: {
              [provider]: {
                defaults: {},
              },
            },
          },
        },
      };
      mocked(exists);

      await expect(
        findLocalMapSource(mockSuperJson, '', profile, provider)
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });
  });

  describe('when looking for local provider.json', () => {
    it('returns provider if file in super.json exists', async () => {
      const testPath = `my/beloved/test/path/to/${provider}`;
      const mockSuperJson = {
        providers: {
          [provider]: {
            file: testPath,
          },
        },
      };
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(JSON.stringify(mockProviderJson));

      await expect(
        findLocalProviderSource(mockSuperJson, '', provider)
      ).resolves.toEqual({
        source: mockProviderJson,
        path: expect.stringContaining(provider),
      });

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(provider));
    });

    it('returns undefined if file in super.json does not exist', async () => {
      const testPath = `my/beloved/test/path/to/${provider}`;
      const mockSuperJson = {
        providers: {
          [provider]: {
            file: testPath,
          },
        },
      };
      mocked(exists).mockResolvedValue(false);

      await expect(
        findLocalProviderSource(mockSuperJson, '', provider)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(provider));
    });

    it('returns undefined if provider does not exist in super.json', async () => {
      const mockSuperJson = {
        profiles: {},
        providers: {},
      };
      mocked(exists);

      await expect(
        findLocalProviderSource(mockSuperJson, '', provider)
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });

    it('returns undefined if file property does not exist in provider', async () => {
      const mockSuperJson = {
        profiles: {},
        providers: {
          [provider]: {},
        },
      };
      mocked(exists);

      await expect(
        findLocalProviderSource(mockSuperJson, '', provider)
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });
  });
});
