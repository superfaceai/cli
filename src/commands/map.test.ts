import { parseProfile, Source } from '@superfaceai/parser';

import { MockLogger } from '../common';
import { createUserError } from '../common/error';
import { fetchSDKToken } from '../common/http';
import { exists, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { UX } from '../common/ux';
import type { NewDotenv } from '../logic';
import {
  createNewDotenv,
  SupportedLanguages,
  writeApplicationCode,
} from '../logic/application-code';
import { mapProviderToProfile } from '../logic/map';
import { prepareProject } from '../logic/project';
import { mockProviderJson } from '../test/provider-json';
import { CommandInstance } from '../test/utils';
import Map from './map';

jest.mock('../common/io');
jest.mock('../common/output-stream');
jest.mock('../common/http');
jest.mock('../logic/map');
jest.mock('../logic/application-code/application-code');
jest.mock('../logic/application-code/dotenv');
jest.mock('../logic/project');

describe('MapCLI command', () => {
  const profileName = 'test';

  const profileSource = (scope: string | undefined, name: string) => `
  name = "${scope !== undefined ? scope + '/' : ''}${name}"
  version = "1.0.0"
  
  "usecase title"
  usecase Foo {
    input {
        field! string!
      }
      
      result number
  }`;
  const mapSource = 'map';
  const providerName = 'test-provider';
  const profileScope = 'test-scope';
  const mockApplicationCode = {
    code: 'mocked application code',
    requiredParameters: ['TEST_PARAMETER'],
    requiredSecurity: ['TEST_SECURITY'],
  };
  const mockDotenv: NewDotenv = {
    content: 'TEST_PARAMETER=\nTEST_SECURITY=',
    newEmptyEnvVariables: ['TEST_PARAMETER', 'TEST_SECURITY'],
  };
  const mockToken = { token: 'sfs_b31314b7fc8...8ec1930e' };
  const providerJson = mockProviderJson({ name: providerName });
  const userError = createUserError(false, false);
  const ux = UX.create();

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running Map command', () => {
    const originalWriteOnce = OutputStream.writeOnce;

    let mockWriteOnce: jest.Mock;
    let instance: Map;
    let logger: MockLogger;

    beforeAll(() => {
      // Mock static side of OutputStream
      mockWriteOnce = jest.fn();
      OutputStream.writeOnce = mockWriteOnce;
    });

    beforeEach(() => {
      instance = CommandInstance(Map);
      logger = new MockLogger();
    });

    afterAll(() => {
      // Restore static side of OutputStream
      OutputStream.writeOnce = originalWriteOnce;
    });

    describe('checking language argument', () => {
      it('throws when language is invalid', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: {
              providerName,
              profileId: profileName,
              language: 'Some other lang',
            },
          })
        ).rejects.toThrow(
          'Language Some other lang is not supported. Supported languages are: python, js'
        );
      });
    });

    describe('checking arguments', () => {
      it('throws when profile id is not provided', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { profileId: profileName },
          })
        ).rejects.toThrow(
          'Missing provider name or profile ID. Usage: `superface map PROVIDERNAME [PROFILEID]`'
        );
      });

      it('throws when provider is not provided', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName },
          })
        ).rejects.toThrow(
          'Missing provider name or profile ID. Usage: `superface map PROVIDERNAME [PROFILEID]`'
        );
      });
    });

    describe('checking profile id argument', () => {
      it('throws when profile id is invalid', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: '!_0%L' },
          })
        ).rejects.toThrow(
          'Invalid profile id: "!_0%L" is not a valid lowercase identifier'
        );
      });

      it('throws when profile file does not exist', async () => {
        jest
          .mocked(exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: '!_0%L' },
          })
        ).rejects.toThrow(
          'Invalid profile id: "!_0%L" is not a valid lowercase identifier'
        );
      });

      it('throws when reading of file fails', async () => {
        jest
          .mocked(exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockRejectedValueOnce(new Error('File read error'));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: profileName },
          })
        ).rejects.toThrow('File read error');
      });

      it('throws when profile source is not valid Comlink', async () => {
        jest
          .mocked(exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson))
          .mockResolvedValueOnce('something');
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: profileName },
          })
        ).rejects.toThrow(`Invalid profile ${profileName}: `);
      });

      it('throws when profile names does not match', async () => {
        jest
          .mocked(exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(profileSource(undefined, 'other'))
          .mockResolvedValueOnce(JSON.stringify(providerJson));

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: profileName },
          })
        ).rejects.toThrow(
          'Profile name in profile file does not match profile name in command.'
        );
      });

      it('throws when profile scopes does not match', async () => {
        jest
          .mocked(exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(profileSource('other', profileName))
          .mockResolvedValueOnce(JSON.stringify(providerJson));

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName, profileId: profileName },
          })
        ).rejects.toThrow(
          'Profile scope in profile file does not match profile scope in command.'
        );
      });
    });

    it('throws when map already exists', async () => {
      const source = profileSource(undefined, profileName);

      jest.mocked(prepareProject).mockResolvedValueOnce({
        saved: true,
        dependencyInstallCommand: 'make install',
        languageDependency: 'TestLang > 18',
        path: 'test',
      });

      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(JSON.stringify(providerJson));

      jest
        .mocked(writeApplicationCode)
        .mockResolvedValueOnce(mockApplicationCode);

      jest.mocked(fetchSDKToken).mockResolvedValueOnce(mockToken);
      jest.mocked(createNewDotenv).mockReturnValueOnce(mockDotenv);

      jest.mocked(mapProviderToProfile).mockResolvedValueOnce(mapSource);

      await instance.execute({
        logger,
        userError,
        flags: {},
        args: { providerName, profileId: profileName },
      });

      expect(mapProviderToProfile).toHaveBeenCalledWith(
        {
          providerJson,
          profile: source,
          options: { quiet: undefined },
        },
        { ux, userError }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(
          `superface/${profileName}.${providerName}.map.js`
        ),
        mapSource
      );
    });

    it('prepares map with scope', async () => {
      const source = profileSource(profileScope, profileName);
      const ast = parseProfile(new Source(source));

      jest.mocked(prepareProject).mockResolvedValueOnce({
        saved: true,
        dependencyInstallCommand: 'make install',
        languageDependency: 'TestLang > 18',
        path: 'test',
      });

      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(JSON.stringify(providerJson));

      jest
        .mocked(writeApplicationCode)
        .mockResolvedValueOnce(mockApplicationCode);

      jest.mocked(fetchSDKToken).mockResolvedValueOnce(mockToken);
      jest.mocked(createNewDotenv).mockReturnValueOnce(mockDotenv);

      jest.mocked(mapProviderToProfile).mockResolvedValueOnce(mapSource);

      await instance.execute({
        logger,
        userError,
        flags: {},
        args: { providerName, profileId: profileScope + '.' + profileName },
      });

      expect(mapProviderToProfile).toHaveBeenCalledWith(
        {
          providerJson,
          profile: source,

          options: { quiet: undefined },
        },
        { ux, userError }
      );

      expect(writeApplicationCode).toHaveBeenCalledWith(
        {
          language: 'js',
          providerJson,
          profileAst: ast,
        },
        {
          logger,
          userError,
        }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(
          `superface/${profileScope}.${profileName}.${providerName}.map.js`
        ),
        mapSource
      );
      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(
          `superface/${profileScope}.${profileName}.${providerName}.mjs`
        ),
        mockApplicationCode.code
      );

      expect(prepareProject).toHaveBeenCalledWith(SupportedLanguages.JS);
    });

    it('prepares map without scope', async () => {
      const source = profileSource(undefined, profileName);
      const ast = parseProfile(new Source(source));

      jest.mocked(prepareProject).mockResolvedValueOnce({
        saved: true,
        dependencyInstallCommand: 'make install',
        languageDependency: 'TestLang > 18',
        path: 'test',
      });

      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(JSON.stringify(providerJson));

      jest.mocked(mapProviderToProfile).mockResolvedValueOnce(mapSource);

      jest
        .mocked(writeApplicationCode)
        .mockResolvedValueOnce(mockApplicationCode);

      jest.mocked(fetchSDKToken).mockResolvedValueOnce(mockToken);
      jest.mocked(createNewDotenv).mockReturnValueOnce(mockDotenv);

      await instance.execute({
        logger,
        userError,
        flags: {},
        args: { providerName, profileId: profileName },
      });

      expect(mapProviderToProfile).toHaveBeenCalledWith(
        {
          providerJson,
          profile: source,
          options: { quiet: undefined },
        },
        { ux, userError }
      );

      expect(writeApplicationCode).toHaveBeenCalledWith(
        {
          providerJson,
          profileAst: ast,
          language: 'js',
        },
        {
          logger,
          userError,
        }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(
          `superface/${profileName}.${providerName}.map.js`
        ),
        mapSource
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(`superface/${profileName}.${providerName}.mjs`),
        mockApplicationCode.code
      );
      expect(prepareProject).toHaveBeenCalledWith(SupportedLanguages.JS);
    });

    it('prepares map with language specified', async () => {
      const source = profileSource(undefined, profileName);
      const ast = parseProfile(new Source(source));

      jest.mocked(prepareProject).mockResolvedValueOnce({
        saved: true,
        dependencyInstallCommand: 'make install',
        languageDependency: 'TestLang > 18',
        path: 'test',
      });

      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(JSON.stringify(providerJson));

      jest.mocked(mapProviderToProfile).mockResolvedValueOnce(mapSource);

      jest
        .mocked(writeApplicationCode)
        .mockResolvedValueOnce(mockApplicationCode);

      jest.mocked(fetchSDKToken).mockResolvedValueOnce(mockToken);
      jest.mocked(createNewDotenv).mockReturnValueOnce(mockDotenv);

      await instance.execute({
        logger,
        userError,
        flags: {},
        args: { providerName, profileId: profileName, language: 'python' },
      });

      expect(mapProviderToProfile).toHaveBeenCalledWith(
        {
          providerJson,
          profile: source,
          options: { quiet: undefined },
        },
        { ux, userError }
      );

      expect(writeApplicationCode).toHaveBeenCalledWith(
        {
          providerJson,
          profileAst: ast,
          language: 'python',
        },
        {
          logger,
          userError,
        }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(
          `superface/${profileName}.${providerName}.map.js`
        ),
        mapSource
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(`superface/${profileName}.${providerName}.py`),
        mockApplicationCode.code
      );
      expect(prepareProject).toHaveBeenCalledWith(SupportedLanguages.PYTHON);
    });
  });
});
