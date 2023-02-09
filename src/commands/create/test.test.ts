import {
  err,
  loadSuperJson,
  ok,
  SDKExecutionError,
} from '@superfaceai/one-sdk';

import { MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import { ProfileId } from '../../common/profile';
import { createTest } from '../../logic/create/test';
import { detectSuperJson } from '../../logic/install';
import { CommandInstance } from '../../test/utils';
import CreateTest from './test';

jest.mock('../../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

jest.mock('../../logic/create/test', () => ({
  createTest: jest.fn(),
}));

jest.mock('@superfaceai/one-sdk', () => ({
  ...jest.requireActual('@superfaceai/one-sdk'),
  loadSuperJson: jest.fn(),
}));

describe('Create test command', () => {
  const userError = createUserError(false);

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running create test command', () => {
    let instance: CreateTest;
    let logger: MockLogger;

    const mockProfile = 'starwars/character-information';
    const mockProvider = 'swapi';

    beforeEach(() => {
      instance = CommandInstance(CreateTest);
      logger = new MockLogger();
    });

    it('throws when super.json not found', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { profileId: mockProfile, providerName: mockProvider },
        })
      ).rejects.toThrow('❌ Unable to create test, super.json not found');
    });

    it('throws when super.json not loaded correctly', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      jest
        .mocked(loadSuperJson)
        .mockResolvedValue(err(new SDKExecutionError('test error', [], [])));
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { profileId: mockProfile, providerName: mockProvider },
        })
      ).rejects.toThrow('Unable to load super.json: test error');
    });

    it('throws error on scan flag higher than 5', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        instance.execute({
          logger,
          userError,
          args: { profileId: mockProfile, providerName: mockProvider },
          flags: {
            scan: 7,
          },
        })
      ).rejects.toThrow(
        '--scan/-s : Number of levels to scan cannot be higher than 5'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid profile id', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      jest.mocked(loadSuperJson).mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          args: { profileId: 'U!0_', providerName: mockProvider },
          flags: {
            scan: 3,
          },
        })
      ).rejects.toThrow(
        'Invalid profile id: "U!0_" is not a valid lowercase identifier'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid provider name', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      jest.mocked(loadSuperJson).mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          args: { profileId: mockProfile, providerName: 'U!0_' },
          flags: {
            scan: 3,
          },
        })
      ).rejects.toThrow('Invalid provider name: U!0_');
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on profile id not found in super.json', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      jest.mocked(loadSuperJson).mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          args: { profileId: mockProfile, providerName: mockProvider },
          flags: {
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `❌ Unable to create test, profile: "${mockProfile}" not found in super.json`
      );
    }, 10000);

    it('throws error on provider not found in super.json', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      jest.mocked(loadSuperJson).mockResolvedValue(
        ok({
          profiles: {
            [mockProfile]: {
              file: '',
            },
          },
        })
      );

      await expect(
        instance.execute({
          logger,
          userError,
          args: { profileId: mockProfile, providerName: mockProvider },
          flags: {
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `❌ Unable to create test, provider: "${mockProvider}" not found in super.json`
      );
    }, 10000);

    it('passes empty flags to logic', async () => {
      const superJson = {
        profiles: {
          [mockProfile]: {
            file: '',
          },
        },
        providers: {
          [mockProvider]: {
            file: '',
          },
        },
      };

      const superJsonPath = '.';
      jest.mocked(detectSuperJson).mockResolvedValue(superJsonPath);
      jest.mocked(loadSuperJson).mockResolvedValue(ok(superJson));

      await instance.execute({
        logger,
        userError,
        args: { profileId: mockProfile, providerName: mockProvider },
        flags: {
          scan: 3,
        },
      });

      expect(createTest).toBeCalledWith(
        {
          profile: ProfileId.fromId(mockProfile, { userError }),
          provider: mockProvider,
          superJson,
          superJsonPath: 'super.json',
          options: {
            station: undefined,
            force: undefined,
          },
        },
        { logger }
      );
    }, 10000);

    it('passes flags to logic', async () => {
      const superJson = {
        profiles: {
          [mockProfile]: {
            file: '',
          },
        },
        providers: {
          [mockProvider]: {
            file: '',
          },
        },
      };

      const superJsonPath = '.';
      jest.mocked(detectSuperJson).mockResolvedValue(superJsonPath);
      jest.mocked(loadSuperJson).mockResolvedValue(ok(superJson));

      await instance.execute({
        logger,
        userError,
        args: { profileId: mockProfile, providerName: mockProvider },
        flags: {
          force: true,
          station: true,
          scan: 3,
        },
      });

      expect(createTest).toBeCalledWith(
        {
          profile: ProfileId.fromId(mockProfile, { userError }),
          provider: mockProvider,
          superJson,
          superJsonPath: 'super.json',
          options: {
            station: true,
            force: true,
          },
        },
        { logger }
      );
    }, 10000);
  });
});
