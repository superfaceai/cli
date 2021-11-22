import { CLIError } from '@oclif/errors';
import { ServiceApiError, ServiceClient } from '@superfaceai/service-client';

import { Logger, MockLogger } from '../common';
import { messages } from '../common/messages';
import Whoami from './whoami';

describe('Whoami CLI command', () => {
  let logger: MockLogger;

  beforeEach(async () => {
    logger = Logger.mockLogger();
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

      await expect(Whoami.run([])).resolves.toBeUndefined();
      expect(getInfoSpy).toHaveBeenCalled();
      expect(logger.stderrOutput).toEqual('');
      expect(logger.stdoutOutput).toContain(
        messages.loggedInAs(mockUserInfo.name, mockUserInfo.email)
      );
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

      await expect(Whoami.run([])).resolves.toBeUndefined();
      expect(getInfoSpy).toHaveBeenCalled();
      expect(logger.stderrOutput).toEqual('');
      expect(logger.stdoutOutput).toContain(messages.notLoggedIn());
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

      await expect(Whoami.run([])).resolves.toBeUndefined();
      expect(getInfoSpy).toHaveBeenCalled();
      expect(logger.stderrOutput).toEqual('');
      expect(logger.stdoutOutput).toContain(
        messages.superfaceServerError(
          mockServerResponse.name,
          mockServerResponse.message
        )
      );
    });

    it('calls getUserInfo correctly, unknown error', async () => {
      const mockErr = new Error('test');
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'getUserInfo')
        .mockRejectedValue(mockErr);

      await expect(Whoami.run([])).rejects.toEqual(new CLIError('test'));
      expect(getInfoSpy).toHaveBeenCalled();
      expect(logger.stderrOutput).toEqual('');
      expect(logger.stdoutOutput).toEqual('');
    });
  });
});
