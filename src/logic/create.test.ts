import { SuperJson } from '@superfaceai/sdk';

import { OutputStream } from '../common/output-stream';
import { empty as emptyMap, pubs as pubsMap } from '../templates/map';
import {
  empty as emptyProfile,
  pubs as pubsProfile,
} from '../templates/profile';
import {
  empty as emptyProvider,
  pubs as pubsProvider,
} from '../templates/provider';
import { createMap, createProfile, createProviderJson } from './create';

describe('Create logic', () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalWriteOnce = OutputStream.writeOnce;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalWriteIfAbsent = OutputStream.writeIfAbsent;
  const mockWriteOnce = jest.fn();
  const mockWriteIfAbsent = jest.fn();

  beforeAll(async () => {
    //Mock static side of OutputStream
    OutputStream.writeOnce = mockWriteOnce;
    OutputStream.writeIfAbsent = mockWriteIfAbsent;
  });

  afterAll(async () => {
    OutputStream.writeOnce = originalWriteOnce;
    OutputStream.writeIfAbsent = originalWriteIfAbsent;
  });

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
      mockWriteIfAbsent.mockResolvedValue(true);

      await expect(
        createProfile(
          mockBasePath,
          mockSuperJson,
          mockId,
          mockUsecaseNames,
          'empty'
        )
      ).resolves.toBeUndefined();

      expect(mockWriteIfAbsent).toHaveBeenCalledTimes(1);
      expect(
        mockWriteIfAbsent
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
      mockWriteIfAbsent.mockResolvedValue(true);

      await expect(
        createProfile(
          mockBasePath,
          mockSuperJson,
          mockId,
          mockUsecaseNames,
          'empty'
        )
      ).resolves.toBeUndefined();

      expect(mockWriteIfAbsent).toHaveBeenCalledTimes(1);
      expect(mockWriteIfAbsent).toHaveBeenCalledWith(
        'test-path/test-name.supr',
        [
          `name = "${mockId.name}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates pubs profile with scope', async () => {
      const mockBasePath = 'test-path';
      const mockId = {
        scope: 'test-scope',
        name: 'test-name',
        version: { major: 1 },
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      mockWriteIfAbsent.mockResolvedValue(true);

      await expect(
        createProfile(
          mockBasePath,
          mockSuperJson,
          mockId,
          mockUsecaseNames,
          'pubs'
        )
      ).resolves.toBeUndefined();

      expect(mockWriteIfAbsent).toHaveBeenCalledTimes(1);
      expect(
        mockWriteIfAbsent
      ).toHaveBeenCalledWith(
        'test-path/test-scope/test-name.supr',
        [
          `name = "${mockId.scope}/${mockId.name}"\nversion = "1.0.0"\n`,
          pubsProfile(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates pubs profile without scope', async () => {
      const mockBasePath = 'test-path';
      const mockId = {
        name: 'test-name',
        version: { major: 1 },
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      mockWriteIfAbsent.mockResolvedValue(true);

      await expect(
        createProfile(
          mockBasePath,
          mockSuperJson,
          mockId,
          mockUsecaseNames,
          'pubs'
        )
      ).resolves.toBeUndefined();

      expect(mockWriteIfAbsent).toHaveBeenCalledTimes(1);
      expect(mockWriteIfAbsent).toHaveBeenCalledWith(
        'test-path/test-name.supr',
        [
          `name = "${mockId.name}"\nversion = "1.0.0"\n`,
          pubsProfile(mockUsecaseNames[0]),
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
      mockWriteIfAbsent.mockResolvedValue(true);

      await expect(
        createMap(
          mockBasePath,
          mockSuperJson,
          mockId,
          mockUsecaseNames,
          'empty'
        )
      ).resolves.toBeUndefined();

      expect(mockWriteIfAbsent).toHaveBeenCalledTimes(1);
      expect(
        mockWriteIfAbsent
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
      mockWriteIfAbsent.mockResolvedValue(true);

      await expect(
        createMap(
          mockBasePath,
          mockSuperJson,
          mockId,
          mockUsecaseNames,
          'empty'
        )
      ).resolves.toBeUndefined();

      expect(mockWriteIfAbsent).toHaveBeenCalledTimes(1);
      expect(
        mockWriteIfAbsent
      ).toHaveBeenCalledWith(
        'test-path/test-name.twilio.suma',
        [
          `profile = "${mockId.name}@1.0"\nprovider = "${mockId.provider}"\n`,
          emptyMap(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates pubs map with scope', async () => {
      const mockBasePath = 'test-path';
      const mockId = {
        scope: 'test-scope',
        name: 'test-name',
        provider: 'twilio',
        version: { major: 1 },
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      mockWriteIfAbsent.mockResolvedValue(true);

      await expect(
        createMap(mockBasePath, mockSuperJson, mockId, mockUsecaseNames, 'pubs')
      ).resolves.toBeUndefined();

      expect(mockWriteIfAbsent).toHaveBeenCalledTimes(1);
      expect(
        mockWriteIfAbsent
      ).toHaveBeenCalledWith(
        'test-path/test-scope/test-name.twilio.suma',
        [
          `profile = "${mockId.scope}/${mockId.name}@1.0"\nprovider = "${mockId.provider}"\n`,
          pubsMap(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates pubs map without scope', async () => {
      const mockBasePath = 'test-path';
      const mockId = {
        name: 'test-name',
        provider: 'twilio',
        version: { major: 1 },
      };
      const mockSuperJson = new SuperJson({});
      const mockUsecaseNames = ['test-usecase'];
      mockWriteIfAbsent.mockResolvedValue(true);

      await expect(
        createMap(mockBasePath, mockSuperJson, mockId, mockUsecaseNames, 'pubs')
      ).resolves.toBeUndefined();

      expect(mockWriteIfAbsent).toHaveBeenCalledTimes(1);
      expect(
        mockWriteIfAbsent
      ).toHaveBeenCalledWith(
        'test-path/test-name.twilio.suma',
        [
          `profile = "${mockId.name}@1.0"\nprovider = "${mockId.provider}"\n`,
          pubsMap(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });
  });
  describe('when creating provider json', () => {
    it('creates pubs provider', async () => {
      const mockBasePath = 'test-path';
      const mockName = 'twilio';
      const mockSuperJson = new SuperJson({});
      mockWriteIfAbsent.mockResolvedValue(true);

      await expect(
        createProviderJson(mockBasePath, mockSuperJson, mockName, 'pubs')
      ).resolves.toBeUndefined();

      expect(mockWriteIfAbsent).toHaveBeenCalledTimes(1);
      expect(
        mockWriteIfAbsent
      ).toHaveBeenCalledWith(
        'test-path/twilio.provider.json',
        pubsProvider(mockName),
        { force: undefined }
      );
    });

    it('creates empty provider', async () => {
      const mockBasePath = 'test-path';
      const mockName = 'twilio';
      const mockSuperJson = new SuperJson({});
      mockWriteIfAbsent.mockResolvedValue(true);

      await expect(
        createProviderJson(mockBasePath, mockSuperJson, mockName, 'empty')
      ).resolves.toBeUndefined();

      expect(mockWriteIfAbsent).toHaveBeenCalledTimes(1);
      expect(
        mockWriteIfAbsent
      ).toHaveBeenCalledWith(
        'test-path/twilio.provider.json',
        emptyProvider(mockName),
        { force: undefined }
      );
    });
  });
});
