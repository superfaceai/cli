import { EXTENSIONS } from '@superfaceai/ast';
import {
  ApiKeyPlacement,
  HttpScheme,
  ProviderJson,
  SecurityType,
  SuperJson,
} from '@superfaceai/one-sdk';
import {
  DEFAULT_PROFILE_VERSION,
  MapId,
  MapVersion,
  ProfileId,
  ProfileVersion,
} from '@superfaceai/parser';
import * as fs from 'fs';
import { mocked } from 'ts-jest/utils';

import { exists, readdir, readFile } from '../common/io';
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
  const version = '1.0.0';
  const mapVersion = '1.0';
  const profile = ProfileId.fromParameters({
    scope: 'starwars',
    version: ProfileVersion.fromString(version),
    name: 'character-information',
  });
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
    it('returns false when error object has unexpected structure', async () => {
      expect(isProviderParseError({})).toEqual(false);
      expect(isProviderParseError({ issues: 'test' })).toEqual(false);
      expect(
        isProviderParseError({ issues: [{ message: '', code: '' }] })
      ).toEqual(false);
      expect(
        isProviderParseError({ issues: [{ path: '', code: '' }] })
      ).toEqual(false);
      expect(
        isProviderParseError({ issues: [{ path: '', message: '' }] })
      ).toEqual(false);
      expect(
        isProviderParseError({ issues: [{ path: '', message: '', code: 2 }] })
      ).toEqual(false);
      expect(
        isProviderParseError({ issues: [{ path: '', message: 2, code: '' }] })
      ).toEqual(false);
      expect(
        isProviderParseError({ issues: [{ path: '', message: '', code: '' }] })
      ).toEqual(false);
      expect(
        isProviderParseError({
          issues: [{ path: [{ test: 'test' }], message: '', code: '' }],
        })
      ).toEqual(false);
    });
    it('returns true when error object has expected structure', async () => {
      expect(isProviderParseError({ issues: [] })).toEqual(true);
      expect(
        isProviderParseError({ issues: [{ path: [], message: '', code: '' }] })
      ).toEqual(true);
      expect(
        isProviderParseError({
          issues: [{ path: ['test', 2], message: '', code: '' }],
        })
      ).toEqual(true);
    });
  });

  describe('when looking for local profile source', () => {
    it('returns source if profile with scope and version exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        findLocalProfileSource(mockSuperJson, profile)
      ).resolves.toEqual(mockProfileSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/${profile.toString()}`)
      );
    });
    it('returns undefinde if profile with scope and version does nit exist in grid', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(false);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        findLocalProfileSource(mockSuperJson, profile)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/${profile.toString()}`)
      );
    });

    it('returns source if profile with version exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        findLocalProfileSource(
          mockSuperJson,
          ProfileId.fromParameters({
            version: ProfileVersion.fromString(version),
            name: profile.name,
          })
        )
      ).resolves.toEqual(mockProfileSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/${profile.toString()}`)
      );
    });

    it('returns source if profile with scope exists', async () => {
      const mockSuperJson = new SuperJson();
      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION.toString()}${
            EXTENSIONS.profile.source
          }`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION.toString()}${
            EXTENSIONS.profile.build
          }`,
        },
      ];
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, profile)
      ).resolves.toEqual(mockProfileSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/starwars`)
      );
      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/${profile.toString()}@${DEFAULT_PROFILE_VERSION.toString()}${
            EXTENSIONS.profile.source
          }`
        )
      );
    });

    it('returns source if profile with scope exists - dirent is symbolic link', async () => {
      const mockSuperJson = new SuperJson();
      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => true,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => false,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION.toString()}${
            EXTENSIONS.profile.source
          }`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION.toString()}${
            EXTENSIONS.profile.build
          }`,
        },
      ];
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, profile)
      ).resolves.toEqual(mockProfileSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/starwars`)
      );
      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/${profile.toString()}@${DEFAULT_PROFILE_VERSION.toString()}${
            EXTENSIONS.profile.source
          }`
        )
      );
    });

    it('returns undefined if profile with scope exists but dirent does not end with source extension', async () => {
      const mockSuperJson = new SuperJson();
      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => true,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => false,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION.toString()}${
            EXTENSIONS.profile.build
          }`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION.toString()}${
            EXTENSIONS.profile.build
          }`,
        },
      ];
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, profile)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/starwars`)
      );
    });

    it('returns undefined if profile with scope exists but dirent name does not', async () => {
      const mockSuperJson = new SuperJson();
      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => true,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => false,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION.toString()}${
            EXTENSIONS.profile.source
          }`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}@${DEFAULT_PROFILE_VERSION.toString()}${
            EXTENSIONS.profile.build
          }`,
        },
      ];
      mocked(exists).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, profile)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/starwars`)
      );
      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/${profile.toString()}@${DEFAULT_PROFILE_VERSION.toString()}${
            EXTENSIONS.profile.source
          }`
        )
      );
    });
    it('returns source if profile with scope and version exists in super json file property', async () => {
      const testPath = `my/beloved/test/path/to/${profile.withoutVersion}@${version}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.withoutVersion}`]: {
            file: testPath,
          },
        },
      });
      mocked(exists).mockResolvedValueOnce(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        findLocalProfileSource(mockSuperJson, profile)
      ).resolves.toEqual(mockProfileSource);

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(testPath));
    });

    it('returns undefined if profile with scope does not exists in super json file property', async () => {
      const testPath = `my/beloved/test/path/to/${profile.withoutVersion}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.withoutVersion}`]: {
            file: testPath,
          },
        },
      });
      mocked(exists).mockResolvedValue(false);
      mocked(readFile).mockResolvedValue(`"mockProfileSource"`);

      await expect(
        findLocalProfileSource(mockSuperJson, profile)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(testPath));
    });
  });

  describe('when looking for local map source', () => {
    it('returns source if file in super.json exists', async () => {
      const testPath = `my/beloved/test/path/to/${provider}.${profile.withoutVersion}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.withoutVersion}`]: {
            version,
            providers: {
              [provider]: {
                file: testPath,
              },
            },
          },
        },
      });
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockMapSource);

      await expect(
        findLocalMapSource(
          mockSuperJson,
          MapId.fromParameters({
            profile,
            provider,
            version: MapVersion.fromString(mapVersion),
          })
        )
      ).resolves.toEqual(mockMapSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`${provider}.${profile.withoutVersion}`)
      );
    });

    it('returns source if file in super.json exists - profile without scope', async () => {
      const testPath = `my/beloved/test/path/to/${provider}.${profile.withoutVersion}`;
      const mockSuperJson = new SuperJson({
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
      });
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockMapSource);

      await expect(
        findLocalMapSource(
          mockSuperJson,
          MapId.fromParameters({
            profile: ProfileId.fromParameters({
              name: profile.name,
              version: ProfileVersion.fromString(version),
            }),
            provider,
            version: MapVersion.fromString(mapVersion),
          })
        )
      ).resolves.toEqual(mockMapSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`${provider}.${profile.withoutVersion}`)
      );
    });

    it('returns undefined if file in super.json does not exist', async () => {
      const testPath = `my/beloved/test/path/to/${provider}.${profile.withoutVersion}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.withoutVersion}`]: {
            version,
            providers: {
              [provider]: {
                file: testPath,
              },
            },
          },
        },
      });
      mocked(exists).mockResolvedValue(false);

      await expect(
        findLocalMapSource(
          mockSuperJson,
          MapId.fromParameters({
            profile,
            provider,
            version: MapVersion.fromString(mapVersion),
          })
        )
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`${provider}.${profile.withoutVersion}`)
      );
    });

    it('returns undefined if profile does not exist in super.json', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {},
      });
      mocked(exists);

      await expect(
        findLocalMapSource(
          mockSuperJson,
          MapId.fromParameters({
            profile,
            provider,
            version: MapVersion.fromString(mapVersion),
          })
        )
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });

    it('returns undefined if profileProvider does not exist in super.json', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.withoutVersion}`]: {
            version,
            providers: {},
          },
        },
      });
      mocked(exists);

      await expect(
        findLocalMapSource(
          mockSuperJson,
          MapId.fromParameters({
            profile,
            provider,
            version: MapVersion.fromString(mapVersion),
          })
        )
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });

    it('returns undefined if file property  does not exist in profileProvider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.withoutVersion}`]: {
            version,
            providers: {
              [provider]: {
                defaults: {},
              },
            },
          },
        },
      });
      mocked(exists);

      await expect(
        findLocalMapSource(
          mockSuperJson,
          MapId.fromParameters({
            profile,
            provider,
            version: MapVersion.fromString(mapVersion),
          })
        )
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });
  });

  describe('when looking for local provider.json', () => {
    it('returns provider if file in super.json exists', async () => {
      const testPath = `my/beloved/test/path/to/${provider}`;
      const mockSuperJson = new SuperJson({
        providers: {
          [provider]: {
            file: testPath,
          },
        },
      });
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(JSON.stringify(mockProviderJson));

      await expect(
        findLocalProviderSource(mockSuperJson, provider)
      ).resolves.toEqual(mockProviderJson);

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(provider));
    });

    it('returns undefined if file in super.json does not exist', async () => {
      const testPath = `my/beloved/test/path/to/${provider}`;
      const mockSuperJson = new SuperJson({
        providers: {
          [provider]: {
            file: testPath,
          },
        },
      });
      mocked(exists).mockResolvedValue(false);

      await expect(
        findLocalProviderSource(mockSuperJson, provider)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(provider));
    });

    it('returns undefined if provider does not exist in super.json', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {},
        providers: {},
      });
      mocked(exists);

      await expect(
        findLocalProviderSource(mockSuperJson, provider)
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });

    it('returns undefined if file property does not exist in provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {},
        providers: {
          [provider]: {},
        },
      });
      mocked(exists);

      await expect(
        findLocalProviderSource(mockSuperJson, provider)
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });
  });
});
