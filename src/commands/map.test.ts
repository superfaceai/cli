import { MockLogger } from '../common';
import { createUserError } from '../common/error';
import { exists, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { mapProviderToProfile } from '../logic/map';
import { mockProviderJson } from '../test/provider-json';
import { CommandInstance } from '../test/utils';
import Map from './map';

jest.mock('../common/io');
jest.mock('../common/output-stream');
jest.mock('../logic/map');

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
  const providerJson = mockProviderJson({ name: providerName });
  const userError = createUserError(false);

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

    describe('checking provider name argument', () => {
      it('throws when provider name is not provided', async () => {
        await expect(
          instance.execute({ logger, userError, flags: {}, args: {} })
        ).rejects.toThrow(
          'Missing provider name. Please provide it as first argument.'
        );
      });

      it('throws when provider name is invalid', async () => {
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName: '!_0%L' },
          })
        ).rejects.toThrow('Invalid provider name');
      });

      it('throws when provider file does not exist', async () => {
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName: 'test', profileId: 'get-user' },
          })
        ).rejects.toThrow(
          'Provider test does not exist. Make sure to run "sf prepare" before running this command.'
        );
      });

      it('throws when reading of file fails', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockRejectedValueOnce(new Error('File read error'));
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName: 'test', profileId: 'get-user' },
          })
        ).rejects.toThrow('File read error');
      });

      it('throws when provider is not valid JSON', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest.mocked(readFile).mockResolvedValueOnce('file content');
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName: 'test', profileId: 'get-user' },
          })
        ).rejects.toThrow(``);
      });

      it('throws when provider is not Provider JSON', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest.mocked(readFile).mockResolvedValueOnce('{"test": 1}');
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName: 'test', profileId: 'get-user' },
          })
        ).rejects.toThrow(``);
      });

      it('throws when provider names does not match', async () => {
        jest.mocked(exists).mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(
            JSON.stringify(mockProviderJson({ name: 'test2' }))
          );
        await expect(
          instance.execute({
            logger,
            userError,
            flags: {},
            args: { providerName: 'test', profileId: 'get-user' },
          })
        ).rejects.toThrow(``);
      });
    });

    describe('checking profile id argument', () => {
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
            args: { providerName },
          })
        ).rejects.toThrow(
          'Missing profile id. Please provide it as first argument.'
        );
      });

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
        ).rejects.toThrow();
      });

      it('throws when profile names does not match', async () => {
        jest
          .mocked(exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true);
        jest
          .mocked(readFile)
          .mockResolvedValueOnce(JSON.stringify(providerJson))
          .mockResolvedValueOnce(profileSource(undefined, 'get-user2'));
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
          .mockResolvedValueOnce(JSON.stringify(providerJson))
          .mockResolvedValueOnce(profileSource('other', profileName));
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
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify(providerJson))
        .mockResolvedValueOnce(profileSource(undefined, profileName));
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
          profileSource: profileSource(undefined, profileName),
          options: { quiet: undefined },
        },
        { logger }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(
          `superface/${profileName}.${providerName}.map.js`
        ),
        mapSource
      );
    });

    it('prepares map with scope', async () => {
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify(providerJson))
        .mockResolvedValueOnce(profileSource(profileScope, profileName));
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
          profileSource: profileSource(profileScope, profileName),
          options: { quiet: undefined },
        },
        { logger }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(
          `superface/${profileScope}.${profileName}.${providerName}.map.js`
        ),
        mapSource
      );
    });

    it('prepares map without scope', async () => {
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      jest
        .mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify(providerJson))
        .mockResolvedValueOnce(profileSource(undefined, profileName));
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
          profileSource: profileSource(undefined, profileName),
          options: { quiet: undefined },
        },
        { logger }
      );

      expect(mockWriteOnce).toHaveBeenCalledWith(
        expect.stringContaining(
          `superface/${profileName}.${providerName}.map.js`
        ),
        mapSource
      );
    });
  });
});
