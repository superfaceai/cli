import { CLIError } from '@oclif/errors';
import { EXTENSIONS } from '@superfaceai/ast';
import { err, ok, SuperJson } from '@superfaceai/one-sdk';
import { SDKExecutionError } from '@superfaceai/one-sdk/dist/internal/errors';

import { MockLogger } from '../common';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { empty as emptyMap } from '../templates/map';
import { empty as emptyProfile } from '../templates/profile';
import { empty as emptyProvider } from '../templates/provider';
import { create, createMap, createProfile, createProviderJson } from './create';

describe('Create logic', () => {
  let logger: MockLogger;
  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(async () => {
    logger = new MockLogger();
  });

  describe('when creating profile', () => {
    it('creates empty profile with scope', async () => {
      const mockBasePath = 'test-path';
      const mockProfile = ProfileId.fromId(`test-scope/test-name`);
      const mockVersion = { major: 1 };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProfile(
          {
            basePath: mockBasePath,
            profile: mockProfile,
            version: mockVersion,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-path/test-scope/test-name.supr',
        [
          `name = "${mockProfile.id}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty profile with scope and file name', async () => {
      const mockBasePath = 'test-path';
      const mockFilename = 'mock-filename';
      const mockProfile = ProfileId.fromId(`test-scope/test-name`);
      const mockVersion = { major: 1 };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProfile(
          {
            basePath: mockBasePath,
            profile: mockProfile,
            version: mockVersion,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
            fileName: mockFilename,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-path/mock-filename.supr',
        [
          `name = "${mockProfile.id}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty profile with scope and file name with extension', async () => {
      const mockBasePath = 'test-path';
      const mockFilename = `mock-filename${EXTENSIONS.profile.source}`;
      const mockProfile = ProfileId.fromId(`test-scope/test-name`);
      const mockVersion = { major: 1 };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProfile(
          {
            basePath: mockBasePath,
            profile: mockProfile,
            version: mockVersion,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
            fileName: mockFilename,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-path/mock-filename.supr',
        [
          `name = "${mockProfile.id}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty profile without scope', async () => {
      const mockBasePath = 'test-path';
      const mockProfile = ProfileId.fromId(`test-name`);
      const mockVersion = { major: 1 };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProfile(
          {
            basePath: mockBasePath,
            profile: mockProfile,
            version: mockVersion,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        'test-path/test-name.supr',
        [
          `name = "${mockProfile.name}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });
  });

  describe('when creating map', () => {
    it('creates empty map with scope', async () => {
      const mockBasePath = 'test-path';
      const mockId = {
        profile: ProfileId.fromScopeName('test-scope', 'test-name'),
        provider: 'twilio',
        version: { major: 1 },
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createMap(
          {
            basePath: mockBasePath,
            id: mockId,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-path/test-scope/test-name.twilio.suma',
        [
          `profile = "${mockId.profile.id}@1.0"\nprovider = "${mockId.provider}"\n`,
          emptyMap(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty map without scope', async () => {
      const mockBasePath = 'test-path';
      const mockId = {
        profile: ProfileId.fromScopeName(undefined, 'test-name'),
        provider: 'twilio',
        version: { major: 1 },
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createMap(
          {
            basePath: mockBasePath,
            id: mockId,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-path/test-name.twilio.suma',
        [
          `profile = "${mockId.profile.name}@1.0"\nprovider = "${mockId.provider}"\n`,
          emptyMap(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty map without scope and with variant', async () => {
      const mockBasePath = 'test-path';
      const mockId = {
        profile: ProfileId.fromScopeName(undefined, 'test-name'),
        provider: 'twilio',
        version: { major: 1 },
        variant: 'bugfix',
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createMap(
          {
            basePath: mockBasePath,
            id: mockId,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-path/test-name.twilio.bugfix.suma',
        [
          `profile = "${mockId.profile.name}@1.0"\nprovider = "${mockId.provider}"\nvariant = "bugfix"\n`,
          emptyMap(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty map without scope, with variant and file name', async () => {
      const mockBasePath = 'test-path';
      const mockFilename = 'test-map';
      const mockId = {
        profile: ProfileId.fromScopeName(undefined, 'test-name'),
        provider: 'twilio',
        version: { major: 1 },
        variant: 'bugfix',
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createMap(
          {
            basePath: mockBasePath,
            id: mockId,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
            fileName: mockFilename,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        `${mockBasePath}/${mockFilename}.suma`,
        [
          `profile = "${mockId.profile.name}@1.0"\nprovider = "${mockId.provider}"\nvariant = "bugfix"\n`,
          emptyMap(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty map without scope, with variant and file name with extension', async () => {
      const mockBasePath = 'test-path';
      const mockFilename = `test-map${EXTENSIONS.map.source}`;
      const mockId = {
        profile: ProfileId.fromScopeName(undefined, 'test-name'),
        provider: 'twilio',
        version: { major: 1 },
        variant: 'bugfix',
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createMap(
          {
            basePath: mockBasePath,
            id: mockId,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
            fileName: mockFilename,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        `${mockBasePath}/${mockFilename}`,
        [
          `profile = "${mockId.profile.name}@1.0"\nprovider = "${mockId.provider}"\nvariant = "bugfix"\n`,
          emptyMap(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });
  });
  describe('when creating provider json', () => {
    it('creates empty provider', async () => {
      const mockBasePath = 'test-path';
      const mockName = 'twilio';
      const mockSuperJson = new SuperJson({});
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProviderJson(
          {
            basePath: mockBasePath,
            provider: mockName,
            superJson: mockSuperJson,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-path/twilio.provider.json',
        emptyProvider(mockName),
        { force: undefined }
      );
    });

    it('creates empty provider with file name', async () => {
      const mockBasePath = 'test-path';
      const mockFilename = 'test-provider';
      const mockName = 'twilio';
      const mockSuperJson = new SuperJson({});
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProviderJson(
          {
            basePath: mockBasePath,
            provider: mockName,
            superJson: mockSuperJson,
            fileName: mockFilename,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        `${mockBasePath}/${mockFilename}.json`,
        emptyProvider(mockName),
        { force: undefined }
      );
    });

    it('creates empty provider with file name with extension', async () => {
      const mockBasePath = 'test-path';
      const mockFilename = 'test-provider.json';
      const mockName = 'twilio';
      const mockSuperJson = new SuperJson({});
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProviderJson(
          {
            basePath: mockBasePath,
            provider: mockName,
            superJson: mockSuperJson,
            fileName: mockFilename,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        `${mockBasePath}/${mockFilename}`,
        emptyProvider(mockName),
        { force: undefined }
      );
    });
  });

  describe('when creating document', () => {
    const mockName = 'test-name';
    const mockProvider = 'provider';
    const secondMockProvider = 'secondProvider';
    const mockScope = 'test-scope';
    const mockSuperPath = 'test-super-path';
    const mockUsecases = ['usecase'];
    const mockFilename = 'test-filename';
    let document: {
      scope?: string;
      name?: string;
      providerNames: string[];
      usecases: string[];
      version: {
        major: number;
        minor: number;
        patch: number;
      };
      variant?: string;
    };
    let mockSuperJson: SuperJson;

    beforeEach(() => {
      mockSuperJson = new SuperJson({});
      document = {
        scope: mockScope,
        name: mockName,
        providerNames: [mockProvider],
        usecases: mockUsecases,
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      };
    });
    it('creates one provider correctly', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: false,
            map: false,
            provider: true,
            document: document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(mockSuperJson.normalized).toEqual({
        profiles: {},
        providers: {
          provider: {
            file: './provider.provider.json',
            security: [],
            parameters: {},
          },
        },
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);

      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        'provider.provider.json',
        emptyProvider(mockProvider),
        { force: undefined }
      );
    });

    it('creates one provider correctly with filename', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: false,
            map: false,
            provider: true,
            document: document,
            paths: {
              superPath: mockSuperPath,
            },
            fileNames: {
              provider: mockFilename,
            },
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(mockSuperJson.normalized).toEqual({
        profiles: {},
        providers: {
          provider: {
            file: `./${mockFilename}.json`,
            security: [],
            parameters: {},
          },
        },
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);

      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        `${mockFilename}.json`,
        emptyProvider(mockProvider),
        { force: undefined }
      );
    });

    it('creates multiple providers correctly', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      document.providerNames = [mockProvider, secondMockProvider];

      await expect(
        create(
          {
            profile: false,
            map: false,
            provider: true,
            document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(mockSuperJson.normalized).toEqual({
        profiles: {},
        providers: {
          provider: {
            file: './provider.provider.json',
            security: [],
            parameters: {},
          },
          secondProvider: {
            file: './secondProvider.provider.json',
            security: [],
            parameters: {},
          },
        },
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(2);

      expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
        1,
        'provider.provider.json',
        emptyProvider(mockProvider),
        { force: undefined }
      );
      expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
        2,
        'secondProvider.provider.json',
        emptyProvider(secondMockProvider),
        { force: undefined }
      );
    });

    it('creates profile correctly', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: true,
            map: false,
            provider: false,
            document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(mockSuperJson.normalized).toEqual({
        profiles: {
          'test-scope/test-name': {
            priority: [],
            defaults: {},
            file: `./${mockScope}/${mockName}.supr`,
            providers: {},
          },
        },
        providers: {},
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);

      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        'test-scope/test-name.supr',
        [
          `name = "${mockScope}/${mockName}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecases[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates profile with file name correctly', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: true,
            map: false,
            provider: false,
            document,
            paths: {
              superPath: mockSuperPath,
            },
            fileNames: {
              profile: mockFilename,
            },
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(mockSuperJson.normalized).toEqual({
        profiles: {
          'test-scope/test-name': {
            priority: [],
            defaults: {},
            file: `./${mockFilename}.supr`,
            providers: {},
          },
        },
        providers: {},
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);

      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        `${mockFilename}.supr`,
        [
          `name = "${mockScope}/${mockName}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecases[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates profile correctly - uses new super json instance', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(err(new SDKExecutionError('mock err', [], [])));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: true,
            map: false,
            provider: false,
            document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(mockSuperJson.normalized).toEqual({
        profiles: {},
        providers: {},
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);

      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        'test-scope/test-name.supr',
        [
          `name = "${mockScope}/${mockName}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecases[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates map and provider correctly', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: false,
            map: true,
            provider: true,
            document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);

      expect(mockSuperJson.normalized).toEqual({
        profiles: {
          'test-scope/test-name': {
            version: '0.0.0',
            defaults: {},
            priority: [mockProvider],
            providers: {
              [mockProvider]: {
                defaults: {},
                file: `./${mockScope}/${mockName}.provider.suma`,
              },
            },
          },
        },
        providers: {
          provider: {
            file: './provider.provider.json',
            security: [],
            parameters: {},
          },
        },
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(2);
      expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
        1,
        'test-scope/test-name.provider.suma',
        [
          `profile = "${mockScope}/${mockName}@1.0"\nprovider = "${mockProvider}"\n`,
          emptyMap(mockUsecases[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );

      expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
        2,
        'provider.provider.json',
        emptyProvider(mockProvider),
        { force: undefined }
      );
    });

    it('creates map correctly', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: false,
            map: true,
            provider: false,
            document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);

      expect(mockSuperJson.normalized).toEqual({
        profiles: {
          'test-scope/test-name': {
            version: '0.0.0',
            defaults: {},
            priority: [mockProvider],
            providers: {
              [mockProvider]: {
                defaults: {},
                file: `./${mockScope}/${mockName}.provider.suma`,
              },
            },
          },
        },
        providers: {},
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-scope/test-name.provider.suma',
        [
          `profile = "${mockScope}/${mockName}@1.0"\nprovider = "${mockProvider}"\n`,
          emptyMap(mockUsecases[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates map with file name correctly', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: false,
            map: true,
            provider: false,
            document,
            paths: {
              superPath: mockSuperPath,
            },
            fileNames: {
              map: mockFilename,
            },
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);

      expect(mockSuperJson.normalized).toEqual({
        profiles: {
          'test-scope/test-name': {
            version: '0.0.0',
            defaults: {},
            priority: [mockProvider],
            providers: {
              [mockProvider]: {
                defaults: {},
                file: `./${mockFilename}.suma`,
              },
            },
          },
        },
        providers: {},
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        `${mockFilename}.suma`,
        [
          `profile = "${mockScope}/${mockName}@1.0"\nprovider = "${mockProvider}"\n`,
          emptyMap(mockUsecases[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates map and profile correctly', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: true,
            map: true,
            provider: false,
            document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);

      expect(mockSuperJson.normalized).toEqual({
        profiles: {
          'test-scope/test-name': {
            file: `./${mockScope}/${mockName}.supr`,
            defaults: {},
            priority: [mockProvider],
            providers: {
              [mockProvider]: {
                defaults: {},
                file: `./${mockScope}/${mockName}.provider.suma`,
              },
            },
          },
        },
        providers: {},
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(2);
      expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
        1,
        'test-scope/test-name.provider.suma',
        [
          `profile = "${mockScope}/${mockName}@1.0"\nprovider = "${mockProvider}"\n`,
          emptyMap(mockUsecases[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
      expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
        2,
        'test-scope/test-name.supr',
        [
          `name = "${mockScope}/${mockName}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecases[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('throws error when provider is missing - creating map', async () => {
      document = {
        scope: mockScope,
        providerNames: [],
        usecases: mockUsecases,
        name: mockName,
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      };

      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: false,
            map: true,
            provider: false,
            document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).rejects.toEqual(
        new CLIError('Provider name must be provided when generating a map.')
      );

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(0);

      expect(mockSuperJson.normalized).toEqual({
        profiles: {},
        providers: {},
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(0);
    });

    it('throws error when provider is missing - creating provider', async () => {
      document = {
        scope: mockScope,
        providerNames: [],
        usecases: mockUsecases,
        name: mockName,
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      };

      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: false,
            map: false,
            provider: true,
            document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).rejects.toEqual(
        new CLIError(
          'Provider name must be provided when generating a provider.'
        )
      );

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(0);

      expect(mockSuperJson.normalized).toEqual({
        profiles: {},
        providers: {},
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(0);
    });

    it('throws error when profile name is missing - creating map', async () => {
      document = {
        scope: mockScope,
        providerNames: [mockProvider],
        usecases: mockUsecases,
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      };

      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: false,
            map: true,
            provider: false,
            document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).rejects.toEqual(
        new CLIError('Profile name must be provided when generating a map.')
      );

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(0);

      expect(mockSuperJson.normalized).toEqual({
        profiles: {},
        providers: {},
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(0);
    });

    it('throws error when profile name is missing - creating profile', async () => {
      document = {
        scope: mockScope,
        providerNames: [mockProvider],
        usecases: mockUsecases,
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      };

      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: true,
            map: false,
            provider: false,
            document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).rejects.toEqual(
        new CLIError('Profile name must be provided when generating a profile.')
      );

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(0);

      expect(mockSuperJson.normalized).toEqual({
        profiles: {},
        providers: {},
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(0);
    });

    it('throws error when provider is missing - creating map and profile', async () => {
      document = {
        scope: mockScope,
        providerNames: [],
        usecases: mockUsecases,
        name: mockName,
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      };

      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          {
            profile: true,
            map: true,
            provider: false,
            document,
            paths: {
              superPath: mockSuperPath,
            },
          },
          { logger }
        )
      ).rejects.toEqual(
        new CLIError('Provider name must be provided when generating a map.')
      );

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(0);

      expect(mockSuperJson.normalized).toEqual({
        profiles: {},
        providers: {},
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(0);
    });
  });
});
