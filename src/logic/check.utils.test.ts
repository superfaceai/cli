import {
  ApiKeyPlacement,
  HttpScheme,
  ProviderJson,
  SecurityType,
  SuperJson,
} from '@superfaceai/one-sdk';
import * as fs from 'fs';
import { mocked } from 'ts-jest/utils';

import { EXTENSIONS } from '../common';
import { exists, readdir, readFile } from '../common/io';
import {
  findLocalMapSource,
  findLocalProfileSource,
  findLocalProviderSource,
} from './check.utils';

jest.mock('../common/io');
describe('Quickstart logic', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  const profile = {
    name: 'character-information',
    scope: 'starwars',
    version: '1.0.0',
  };

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

  describe('when looking for local profile source', () => {
    it('returns source if profile with scope and version exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        findLocalProfileSource(mockSuperJson, profile)
      ).resolves.toEqual(mockProfileSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/${profile.scope}/${profile.name}@${profile.version}`
        )
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
        expect.stringContaining(
          `grid/${profile.scope}/${profile.name}@${profile.version}`
        )
      );
    });

    it('returns source if profile with version exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        findLocalProfileSource(mockSuperJson, {
          name: profile.name,
          version: profile.version,
        })
      ).resolves.toEqual(mockProfileSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/${profile.name}@${profile.version}`)
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
          name: `${profile.name}${EXTENSIONS.profile.source}`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}${EXTENSIONS.profile.build}`,
        },
      ];
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, {
          name: profile.name,
          scope: profile.scope,
        })
      ).resolves.toEqual(mockProfileSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/starwars`)
      );
      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/starwars/character-information${EXTENSIONS.profile.source}`
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
          name: `${profile.name}${EXTENSIONS.profile.source}`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}${EXTENSIONS.profile.build}`,
        },
      ];
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, {
          name: profile.name,
          scope: profile.scope,
        })
      ).resolves.toEqual(mockProfileSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/starwars`)
      );
      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/starwars/character-information${EXTENSIONS.profile.source}`
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
          name: `${profile.name}${EXTENSIONS.profile.build}`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}${EXTENSIONS.profile.build}`,
        },
      ];
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, {
          name: profile.name,
          scope: profile.scope,
        })
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
          name: `${profile.name}${EXTENSIONS.profile.source}`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.name}${EXTENSIONS.profile.build}`,
        },
      ];
      mocked(exists).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        findLocalProfileSource(mockSuperJson, {
          name: profile.name,
          scope: profile.scope,
        })
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/starwars`)
      );
      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/starwars/character-information${EXTENSIONS.profile.source}`
        )
      );
    });
    it('returns source if profile with scope and version exists in super json file property', async () => {
      const testPath = `my/beloved/test/path/to/${profile.scope}/${profile.name}@${profile.version}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
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
      const testPath = `my/beloved/test/path/to/${profile.scope}/${profile.name}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
            file: testPath,
          },
        },
      });
      mocked(exists).mockResolvedValue(false);
      mocked(readFile).mockResolvedValue(`"mockProfileSource"`);

      await expect(
        findLocalProfileSource(mockSuperJson, {
          name: profile.name,
          scope: profile.scope,
        })
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(testPath));
    });
  });

  describe('when looking for local map source', () => {
    it('returns source if file in super.json exists', async () => {
      const testPath = `my/beloved/test/path/to/${provider}.${profile.scope}/${profile.name}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
            version: profile.version,
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
        findLocalMapSource(mockSuperJson, profile, provider)
      ).resolves.toEqual(mockMapSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`${provider}.${profile.scope}/${profile.name}`)
      );
    });

    it('returns source if file in super.json exists - profile without scope', async () => {
      const testPath = `my/beloved/test/path/to/${provider}.${profile.scope}/${profile.name}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.name}`]: {
            version: profile.version,
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
        findLocalMapSource(mockSuperJson, { name: profile.name }, provider)
      ).resolves.toEqual(mockMapSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`${provider}.${profile.scope}/${profile.name}`)
      );
    });

    it('returns undefined if file in super.json does not exist', async () => {
      const testPath = `my/beloved/test/path/to/${provider}.${profile.scope}/${profile.name}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
            version: profile.version,
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
        findLocalMapSource(mockSuperJson, profile, provider)
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`${provider}.${profile.scope}/${profile.name}`)
      );
    });

    it('returns undefined if profile does not exist in super.json', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {},
      });
      mocked(exists);

      await expect(
        findLocalMapSource(mockSuperJson, profile, provider)
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });

    it('returns undefined if profileProvider does not exist in super.json', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
            version: profile.version,
            providers: {},
          },
        },
      });
      mocked(exists);

      await expect(
        findLocalMapSource(mockSuperJson, profile, provider)
      ).resolves.toBeUndefined();

      expect(exists).not.toHaveBeenCalled();
    });

    it('returns undefined if file property  does not exist in profileProvider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.name}`]: {
            version: profile.version,
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
        findLocalMapSource(mockSuperJson, profile, provider)
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
