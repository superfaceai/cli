import {
  err,
  loadSuperJson,
  ok,
  SDKExecutionError,
} from '@superfaceai/one-sdk';

import { MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import { createProvider } from '../../logic/create/provider';
import { detectSuperJson } from '../../logic/install';
import { CommandInstance } from '../../test/utils';
import { Provider } from './provider';

jest.mock('../../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

jest.mock('../../logic/create/provider', () => ({
  createProvider: jest.fn(),
}));

jest.mock('@superfaceai/one-sdk', () => ({
  ...jest.requireActual('@superfaceai/one-sdk'),
  loadSuperJson: jest.fn(),
}));

describe('Create provider command', () => {
  const userError = createUserError(false);

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running create command', () => {
    let instance: Provider;
    let logger: MockLogger;

    const mockProvider = 'swapi';

    beforeEach(() => {
      instance = CommandInstance(Provider);
      logger = new MockLogger();
    });

    it('throws when super.json not found', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {},
          args: { providerName: mockProvider },
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
          args: { providerName: mockProvider },
        })
      ).rejects.toThrow('Unable to load super.json: test error');
    });

    it('throws error on scan flag higher than 5', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        instance.execute({
          logger,
          userError,
          args: { providerName: mockProvider },
          flags: {
            scan: 7,
          },
        })
      ).rejects.toThrow(
        '--scan/-s : Number of levels to scan cannot be higher than 5'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid provider name', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      jest.mocked(loadSuperJson).mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          args: { providerName: 'U!0_' },
          flags: {
            scan: 3,
          },
        })
      ).rejects.toThrow('Invalid provider name: U!0_');
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('passes empty flags to logic', async () => {
      const superJson = {
        profiles: {},
        providers: {},
      };

      const superJsonPath = '.';
      jest.mocked(detectSuperJson).mockResolvedValue(superJsonPath);
      jest.mocked(loadSuperJson).mockResolvedValue(ok(superJson));

      await instance.execute({
        logger,
        userError,
        args: { providerName: mockProvider },
        flags: {
          scan: 3,
        },
      });

      expect(createProvider).toBeCalledWith(
        {
          provider: mockProvider,
          superJson,
          superJsonPath: 'super.json',
          options: {},
        },
        { logger, userError }
      );
    }, 10000);

    it('passes flags to logic', async () => {
      const superJson = {
        profiles: {},
        providers: {},
      };

      const superJsonPath = '.';
      jest.mocked(detectSuperJson).mockResolvedValue(superJsonPath);
      jest.mocked(loadSuperJson).mockResolvedValue(ok(superJson));

      await instance.execute({
        logger,
        userError,
        args: { providerName: mockProvider },
        flags: {
          force: true,
          station: true,
          scan: 3,
        },
      });

      expect(createProvider).toBeCalledWith(
        {
          provider: mockProvider,
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
