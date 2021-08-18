import { SuperJson } from '@superfaceai/one-sdk';
import * as fs from 'fs';
import { mocked } from 'ts-jest/utils';

import { EXTENSIONS } from '../common';
import { exists, readdir, readFile } from '../common/io';
import {
  loadProfileSource,
  profileExists,
  providerExists,
} from './quickstart.utils';

jest.mock('../common/io');
describe('Quickstart logic', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  const profile = {
    profile: 'character-information',
    scope: 'starwars',
    version: '1.0.0',
  };

  const mockProfileSource = 'mock profile';

  describe('when loading profile AST', () => {
    it('returns ast if profile with scope and version exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(loadProfileSource(mockSuperJson, profile)).resolves.toEqual(
        mockProfileSource
      );

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/${profile.scope}/${profile.profile}@${profile.version}`
        )
      );
    });

    it('returns ast if profile with version exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        loadProfileSource(mockSuperJson, {
          profile: profile.profile,
          version: profile.version,
        })
      ).resolves.toEqual(mockProfileSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/${profile.profile}@${profile.version}`)
      );
    });

    it('returns ast if profile with scope exists', async () => {
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
          name: `${profile.profile}@${profile.version}${EXTENSIONS.profile.source}`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.profile}@${profile.version}${EXTENSIONS.profile.build}`,
        },
      ];
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        loadProfileSource(mockSuperJson, {
          profile: profile.profile,
          scope: profile.scope,
        })
      ).resolves.toEqual(mockProfileSource);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/starwars`)
      );
      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/${profile.scope}/${profile.profile}@${profile.version}${EXTENSIONS.profile.source}`
        )
      );
    });
    it('returns ast if profile with scope and version exists in super json file property', async () => {
      const testPath = `my/beloved/test/path/to/${profile.scope}/${profile.profile}@${profile.version}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.profile}`]: {
            version: profile.version,
            file: testPath,
          },
        },
      });
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(loadProfileSource(mockSuperJson, profile)).resolves.toEqual(
        mockProfileSource
      );

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(testPath));
    });

    it('returns undefined if profile with scope does not exists in super json file property', async () => {
      const testPath = `my/beloved/test/path/to/${profile.scope}/${profile.profile}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.profile}`]: {
            version: profile.version,
            file: testPath,
          },
        },
      });
      mocked(exists).mockResolvedValue(false);
      mocked(readFile).mockResolvedValue(mockProfileSource);

      await expect(
        loadProfileSource(mockSuperJson, {
          profile: profile.profile,
          scope: profile.scope,
        })
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(testPath));
    });
  });

  describe('when checking that profile already exists', () => {
    it('returns true if source file exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);

      await expect(
        profileExists(mockSuperJson, {
          profile: 'character-information',
          scope: 'starwars',
          version: '1.0.0',
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledTimes(1);
    });

    it('returns false if source file does not exist', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(false);

      await expect(
        profileExists(mockSuperJson, {
          profile: 'character-information',
          scope: 'starwars',
          version: '1.0.0',
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledTimes(1);
    });

    it('returns true if there is correct file property', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          ['communication/send-email']: {
            file: 'some/path',
            providers: {
              sendgrid: {},
            },
          },
        },
        providers: {
          sendgrid: {
            security: [],
          },
        },
      });
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(
        profileExists(mockSuperJson, {
          scope: 'communication',
          profile: 'send-email',
          version: '1.0.0',
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledTimes(2);
    });

    it('returns false if there is different file property', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          ['communication/send-email']: {
            file: 'some/path',
            providers: {
              sendgrid: {},
            },
          },
        },
        providers: {
          sendgrid: {
            security: [],
          },
        },
      });
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(
        profileExists(mockSuperJson, {
          scope: 'vcs',
          profile: 'pull-request',
          version: '1.0.0',
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledTimes(1);
    });
  });

  describe('when checking that provider already exists', () => {
    it('returns true if provider is defined in super.json', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          ['communication/send-email']: {
            file: 'some/path',
            providers: {
              sendgrid: {},
            },
          },
        },
        providers: {
          sendgrid: {
            security: [],
          },
        },
      });

      expect(providerExists(mockSuperJson, 'sendgrid')).toEqual(true);
    });

    it('returns false if source file does not exist', async () => {
      const mockSuperJson = new SuperJson();

      expect(providerExists(mockSuperJson, 'sendgrid')).toEqual(false);
    });
  });
});
