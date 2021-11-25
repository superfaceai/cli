import { CLIError } from '@oclif/errors';
import { ServiceApiError, ServiceClient } from '@superfaceai/service-client';

import { MockLogger } from '../common';
import { CommandInstance } from '../test/utils';
import Whoami from './whoami';

describe('Whoami CLI command', () => {
  let logger: MockLogger;
  let instance: Whoami;

  beforeEach(async () => {
    logger = new MockLogger();
    instance = CommandInstance(Whoami);
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe('when running whoami command', () => {
    it('calls getUserInfo correctly, user logged in', async () => {
      const mockUserInfo = {
        name: 'jakub.vacek',
        email: 'jakub.vacek@dxheroes.io',
        accounts: [],
      };
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'getUserInfo')
        .mockResolvedValue(mockUserInfo);

      await expect(
        instance.execute({ logger, flags: {} })
      ).resolves.toBeUndefined();
      expect(getInfoSpy).toHaveBeenCalled();
      expect(logger.stderr).toEqual([]);
      expect(logger.stdout).toContainEqual([
        'loggedInAs',
        [mockUserInfo.name, mockUserInfo.email],
      ]);
    });

    it('calls getUserInfo correctly, user logged out', async () => {
      const mockServerResponse = new ServiceApiError({
        status: 401,
        instance: '',
        title: 'Unathorized',
        detail: 'unathorized',
      });
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'getUserInfo')
        .mockRejectedValue(mockServerResponse);

      await expect(
        instance.execute({ logger, flags: {} })
      ).resolves.toBeUndefined();
      expect(getInfoSpy).toHaveBeenCalled();
      expect(logger.stderr).toEqual([]);
      expect(logger.stdout).toContainEqual(['notLoggedIn', []]);
    });

    it('calls getUserInfo correctly, unknown Superface response', async () => {
      const mockServerResponse = new ServiceApiError({
        status: 403,
        instance: '',
        title: 'Forbiden',
        detail: 'forbiden access',
      });
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'getUserInfo')
        .mockRejectedValue(mockServerResponse);

      await expect(
        instance.execute({ logger, flags: {} })
      ).resolves.toBeUndefined();
      expect(getInfoSpy).toHaveBeenCalled();
      expect(logger.stderr).toEqual([]);
      expect(logger.stdout).toContainEqual([
        'superfaceServerError',
        [mockServerResponse.name, mockServerResponse.message],
      ]);
    });

    it('calls getUserInfo correctly, unknown error', async () => {
      const mockErr = new Error('test');
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'getUserInfo')
        .mockRejectedValue(mockErr);

      await expect(instance.execute({ logger, flags: {} })).rejects.toEqual(
        new CLIError('test')
      );
      expect(getInfoSpy).toHaveBeenCalled();
      expect(logger.stderr).toEqual([]);
      expect(logger.stdout).toEqual([]);
    });
  });
});
