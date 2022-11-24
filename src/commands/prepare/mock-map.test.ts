import {
  err,
  loadSuperJson,
  ok,
  SDKExecutionError,
} from '@superfaceai/one-sdk';

import { MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import { ProfileId } from '../../common/profile';
import { detectSuperJson } from '../../logic/install';
import { prepareMockMap } from '../../logic/prepare/mock-map';
import { CommandInstance } from '../../test/utils';
import { MockMap } from './mock-map';

jest.mock('../../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

jest.mock('../../logic/prepare/mock-map', () => ({
  prepareMockMap: jest.fn(),
}));

jest.mock('@superfaceai/one-sdk', () => ({
  ...jest.requireActual('@superfaceai/one-sdk'),
  loadSuperJson: jest.fn(),
}));

describe('Prepare mock map command', () => {
  const userError = createUserError(false);

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running prepare command', () => {
    let instance: MockMap;
    let logger: MockLogger;

    const mockProfile = 'starwars/character-information';
    const mockProvider = 'swapi';

    beforeEach(() => {
      instance = CommandInstance(MockMap);
      logger = new MockLogger();
    });

    it('throws when super.json not found', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { profileId: mockProfile },
        })
      ).rejects.toThrow('Unable to load super.json, super.json not found');
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
          args: { profileId: mockProfile },
        })
      ).rejects.toThrow('Unable to load super.json: test error');
    });

    it('throws error on scan flag higher than 5', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        instance.execute({
          logger,
          userError,
          args: { profileId: mockProfile },
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
          args: { profileId: 'U!0_' },
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

    it('throws error on profile id not found in super.json', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      jest.mocked(loadSuperJson).mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          args: { profileId: mockProfile },
          flags: {
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Unable to prepare, profile: "${mockProfile}" not found in super.json`
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
        args: { profileId: mockProfile },
        flags: {
          scan: 3,
        },
      });

      expect(prepareMockMap).toBeCalledWith(
        {
          id: {
            profile: ProfileId.fromId(mockProfile, { userError }),
          },
          superJson,
          superJsonPath: 'super.json',
          options: {},
        },
        { logger, userError }
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
        args: { profileId: mockProfile },
        flags: {
          force: true,
          station: true,
          scan: 3,
        },
      });

      expect(prepareMockMap).toBeCalledWith(
        {
          id: {
            profile: ProfileId.fromId(mockProfile, { userError }),
          },
          superJson,
          superJsonPath: 'super.json',
          options: {
            station: true,
            force: true,
          },
        },
        { logger, userError }
      );
    }, 10000);
  });
});
