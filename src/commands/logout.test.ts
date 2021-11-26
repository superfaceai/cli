import { ServiceClient, ServiceClientError } from '@superfaceai/service-client';

import { MockLogger } from '../common';
import { CommandInstance } from '../test/utils';
import Logout from './logout';

describe('Logout CLI command', () => {
  let logger: MockLogger;
  let instance: Logout;

  beforeEach(async () => {
    logger = new MockLogger();
    instance = CommandInstance(Logout);
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe('when running logout command', () => {
    it('calls signOut correctly, user logged in', async () => {
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'signOut')
        .mockResolvedValue(null);

      await expect(
        instance.execute({ logger, flags: {} })
      ).resolves.toBeUndefined();
      expect(getInfoSpy).toHaveBeenCalled();
      expect(logger.stderr).toEqual([]);
      expect(logger.stdout).toContainEqual(['loggoutSuccessfull', []]);
    });

    it('calls getUserInfo correctly, user logged out', async () => {
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'signOut')
        .mockRejectedValue(
          new ServiceClientError("No session found, couldn't log out")
        );

      await expect(
        instance.execute({ logger, flags: {} })
      ).resolves.toBeUndefined();
      expect(getInfoSpy).toHaveBeenCalled();
      expect(logger.stderr).toEqual([]);
      expect(logger.stdout).toContainEqual([
        'superfaceServerError',
        ['Error', "No session found, couldn't log out"],
      ]);
    });

    it('calls getUserInfo correctly, unknown error', async () => {
      const mockErr = new Error('test');
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'signOut')
        .mockRejectedValue(mockErr);

      await expect(instance.execute({ logger, flags: {} })).rejects.toThrow(
        'test'
      );
      expect(getInfoSpy).toHaveBeenCalled();
      expect(logger.stderr).toEqual([]);
      expect(logger.stdout).toEqual([]);
    });
  });
});
