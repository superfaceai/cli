import { CLIError } from '@oclif/errors';
import { err, ok, SuperJson } from '@superfaceai/one-sdk';

import { OutputStream } from '../common/output-stream';
import { empty as emptyMap } from '../templates/map';
import { empty as emptyProfile } from '../templates/profile';
import { empty as emptyProvider } from '../templates/provider';
import { create, createMap, createProfile, createProviderJson } from './create';

describe('Create logic', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when creating profile', () => {
    it('creates empty profile with scope', async () => {
      const mockBasePath = 'test-path';
      const mockId = {
        scope: 'test-scope',
        name: 'test-name',
        version: { major: 1 },
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProfile(mockBasePath, mockId, mockUsecaseNames, mockSuperJson)
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-path/test-scope/test-name.supr',
        [
          `name = "${mockId.scope}/${mockId.name}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty profile without scope', async () => {
      const mockBasePath = 'test-path';
      const mockId = {
        name: 'test-name',
        version: { major: 1 },
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProfile(mockBasePath, mockId, mockUsecaseNames, mockSuperJson)
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        'test-path/test-name.supr',
        [
          `name = "${mockId.name}"\nversion = "1.0.0"\n`,
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
        scope: 'test-scope',
        name: 'test-name',
        provider: 'twilio',
        version: { major: 1 },
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createMap(mockBasePath, mockId, mockUsecaseNames, mockSuperJson)
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-path/test-scope/test-name.twilio.suma',
        [
          `profile = "${mockId.scope}/${mockId.name}@1.0"\nprovider = "${mockId.provider}"\n`,
          emptyMap(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty map without scope', async () => {
      const mockBasePath = 'test-path';
      const mockId = {
        name: 'test-name',
        provider: 'twilio',
        version: { major: 1 },
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createMap(mockBasePath, mockId, mockUsecaseNames, mockSuperJson)
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-path/test-name.twilio.suma',
        [
          `profile = "${mockId.name}@1.0"\nprovider = "${mockId.provider}"\n`,
          emptyMap(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty map without scope and with variant', async () => {
      const mockBasePath = 'test-path';
      const mockId = {
        name: 'test-name',
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
        createMap(mockBasePath, mockId, mockUsecaseNames, mockSuperJson)
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(
        writeIfAbsentSpy
      ).toHaveBeenCalledWith(
        'test-path/test-name.twilio.bugfix.suma',
        [
          `profile = "${mockId.name}@1.0"\nprovider = "${mockId.provider}"\nvariant = "bugfix"\n`,
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
        createProviderJson(mockBasePath, mockName, mockSuperJson)
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
  });

  describe('when creating document', () => {
    const mockName = 'test-name';
    const mockProvider = 'provider';
    const secondMockProvider = 'secondProvider';
    const mockScope = 'test-scope';
    const mockSuperPath = 'test-super-path';
    const mockUsecases = ['usecase'];
    let mockDocumentStructure: {
      scope?: string;
      name?: string;
      providerNames: string[];
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
      mockDocumentStructure = {
        scope: mockScope,
        name: mockName,
        providerNames: [mockProvider],
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
          { createProfile: false, createMap: false, createProvider: true },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(mockSuperJson.normalized).toEqual({
        profiles: {},
        providers: {
          provider: { file: 'provider.provider.json', security: [] },
        },
      });

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);

      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        'provider.provider.json',
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

      mockDocumentStructure.providerNames = [mockProvider, secondMockProvider];

      await expect(
        create(
          { createProfile: false, createMap: false, createProvider: true },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(mockSuperJson.normalized).toEqual({
        profiles: {},
        providers: {
          provider: { file: 'provider.provider.json', security: [] },
          secondProvider: {
            file: 'secondProvider.provider.json',
            security: [],
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
          { createProfile: true, createMap: false, createProvider: false },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(mockSuperJson.normalized).toEqual({
        profiles: {
          'test-scope/test-name': {
            priority: [],
            defaults: {},
            file: `${mockScope}/${mockName}.supr`,
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

    it('creates profile correctly - uses new super json instance', async () => {
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(err('mock err'));
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        create(
          { createProfile: true, createMap: false, createProvider: false },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
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
          { createProfile: false, createMap: true, createProvider: true },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
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
                file: `${mockScope}/${mockName}.provider.suma`,
              },
            },
          },
        },
        providers: {
          provider: { file: 'provider.provider.json', security: [] },
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
          { createProfile: false, createMap: true, createProvider: false },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
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
                file: `${mockScope}/${mockName}.provider.suma`,
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
          { createProfile: true, createMap: true, createProvider: false },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);

      expect(mockSuperJson.normalized).toEqual({
        profiles: {
          'test-scope/test-name': {
            file: `${mockScope}/${mockName}.supr`,
            defaults: {},
            priority: [mockProvider],
            providers: {
              [mockProvider]: {
                defaults: {},
                file: `${mockScope}/${mockName}.provider.suma`,
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
      mockDocumentStructure = {
        scope: mockScope,
        providerNames: [],
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
          { createProfile: false, createMap: true, createProvider: false },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
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
      mockDocumentStructure = {
        scope: mockScope,
        providerNames: [],
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
          { createProfile: false, createMap: false, createProvider: true },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
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
      mockDocumentStructure = {
        scope: mockScope,
        providerNames: [mockProvider],
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
          { createProfile: false, createMap: true, createProvider: false },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
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
      mockDocumentStructure = {
        scope: mockScope,
        providerNames: [mockProvider],
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
          { createProfile: true, createMap: false, createProvider: false },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
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
      mockDocumentStructure = {
        scope: mockScope,
        providerNames: [],
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
          { createProfile: true, createMap: true, createProvider: false },
          mockUsecases,
          mockDocumentStructure,
          mockSuperPath
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
