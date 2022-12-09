import type { SuperJsonDocument } from '@superfaceai/ast';
import {
  err,
  loadSuperJson,
  ok,
  SDKExecutionError,
} from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { DEFAULT_PROFILE_VERSION_STR, MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import { ProfileId } from '../../common/profile';
import { detectSuperJson } from '../../logic/install';
import { prepareProfile } from '../../logic/prepare';
import { CommandInstance } from '../../test/utils';
import { Profile } from './profile';

jest.mock('@superfaceai/one-sdk', () => ({
  ...jest.requireActual<Record<string, unknown>>('@superfaceai/one-sdk'),
  loadSuperJson: jest.fn(),
}));

jest.mock('../../logic/prepare', () => ({
  prepareProfile: jest.fn(),
}));

jest.mock('../../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

describe('Prepare profile command', () => {
  const userError = createUserError(false);
  let profileId: string;
  let logger: MockLogger;
  let instance: Profile;

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    logger = new MockLogger();
    instance = CommandInstance(Profile);
  });

  describe('when running prepare profile command', () => {
    it('throws when profile name is missing', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          args: {
            profileId: undefined,
          },
          flags: {
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).rejects.toEqual(userError('--profileId must be specified', 1));
      expect(prepareProfile).not.toBeCalled();
    });

    it('throws when profile name is incorect', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          args: {
            profileId: '_"!O/',
          },
          flags: {
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).rejects.toEqual(
        userError('_"!O is not a valid lowercase identifier', 1)
      );
      expect(prepareProfile).not.toBeCalled();
    });

    it('throws when version is missing patch part', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          args: {
            profileId: 'get-info',
          },
          flags: {
            usecase: [],
            version: '2.2',
          },
        })
      ).rejects.toEqual(
        userError(
          'Full version must be specified in format: "[major].[minor].[patch]"',
          1
        )
      );
      expect(prepareProfile).not.toBeCalled();
    });

    it('throws when version is missing minor part', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          args: {
            profileId: 'get-info',
          },
          flags: {
            usecase: [],
            version: '2',
          },
        })
      ).rejects.toEqual(
        userError(
          'Full version must be specified in format: "[major].[minor].[patch]"',
          1
        )
      );
      expect(prepareProfile).not.toBeCalled();
    });

    it('throws when scan is higher than 5', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          args: {
            profileId: 'test',
          },
          flags: {
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
            scan: 6,
          },
        })
      ).rejects.toEqual(
        userError(
          '--scan/-s : Number of levels to scan cannot be higher than 5',
          1
        )
      );
      expect(prepareProfile).not.toBeCalled();
    });

    it('throws when use case name is invalid', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          args: {
            profileId: 'test',
          },
          flags: {
            usecase: ['!_"L%O'],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).rejects.toEqual(userError('Invalid usecase name: !_"L%O', 1));
      expect(prepareProfile).not.toBeCalled();
    });

    it('throws when use case name starts with lower case letter', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          args: {
            profileId: 'test',
          },
          flags: {
            usecase: ['getInfo'],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).rejects.toEqual(
        userError(
          'Invalid usecase name: getInfo, usecase name must start with upper case letter',
          1
        )
      );
      expect(prepareProfile).not.toBeCalled();
    });

    it('throws when unable to find super.json', async () => {
      await expect(
        instance.execute({
          logger,
          userError,
          args: {
            profileId: 'test',
          },
          flags: {
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).rejects.toEqual(
        userError('Unable to prepare profile, super.json not found', 1)
      );
      expect(prepareProfile).not.toBeCalled();
    });

    it('throws when there is an error during super.json loading', async () => {
      profileId = 'messages/sendsms';
      const error = new SDKExecutionError('test', [], []);
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(loadSuperJson).mockResolvedValue(err(error));
      await expect(
        instance.execute({
          logger,
          userError,
          args: {
            profileId,
          },
          flags: {
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).rejects.toEqual(
        userError(`Unable to load super.json: ${error.formatShort()}`, 1)
      );
      expect(prepareProfile).not.toBeCalled();
    });

    it('prepares profile with one usecase from profile name', async () => {
      profileId = 'messages/sendsms';
      const superjson: SuperJsonDocument = {
        profiles: {
          [profileId]: {
            file: '',
          },
        },
      };
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(loadSuperJson).mockResolvedValue(ok(superjson));
      await expect(
        instance.execute({
          logger,
          userError,
          args: {
            profileId,
          },
          flags: {
            usecase: [],
            version: DEFAULT_PROFILE_VERSION_STR,
          },
        })
      ).resolves.toBeUndefined();
      expect(prepareProfile).toHaveBeenCalledTimes(1);
      expect(prepareProfile).toHaveBeenCalledWith(
        {
          id: {
            profile: ProfileId.fromId(profileId, { userError }),
            version: '1.0.0',
          },
          usecaseNames: ['Sendsms'],
          superJson: superjson,
          superJsonPath: 'super.json',
          options: {
            force: undefined,
            station: undefined,
          },
        },
        {
          logger,
        }
      );
    });

    it('creates profile with one usecase from flags', async () => {
      profileId = 'sendsms';
      const superjson: SuperJsonDocument = {
        profiles: {
          [profileId]: {
            file: '',
          },
        },
      };
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(loadSuperJson).mockResolvedValue(ok(superjson));
      await expect(
        instance.execute({
          logger,
          userError,
          args: {
            profileId,
          },
          flags: {
            usecase: ['SendSms'],
            version: '3.2.1',
          },
        })
      ).resolves.toBeUndefined();
      expect(prepareProfile).toHaveBeenCalledTimes(1);
      expect(prepareProfile).toHaveBeenCalledWith(
        {
          id: {
            profile: ProfileId.fromId(profileId, { userError }),
            version: '3.2.1',
          },
          usecaseNames: ['SendSms'],
          superJson: superjson,
          superJsonPath: 'super.json',
          options: {
            force: undefined,
            station: undefined,
          },
        },
        {
          logger,
        }
      );
    });
  });
});
