import { CLIError } from '@oclif/errors';
import { ServiceApiError, ServiceClient } from '@superfaceai/service-client';

import { MockStd, mockStd } from '../test/mock-std';
import Whoami from './whoami';

describe('Whoami CLI command', () => {
  let stdout: MockStd;
  let stderr: MockStd;

  beforeEach(async () => {
    stdout = mockStd();
    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
    stderr = mockStd();
    jest
      .spyOn(process['stderr'], 'write')
      .mockImplementation(stderr.implementation);
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
      expect(stderr.output).toEqual('');
      expect(stdout.output).toEqual(
        `🆗 You are logged in as: ${mockUserInfo.name} (${mockUserInfo.email})\n`
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
      expect(stderr.output).toEqual('');
      expect(stdout.output).toEqual(
        '❌ You are not logged in. Please try running "sf login"\n'
      );
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
      expect(stderr.output).toEqual('');
      expect(stdout.output).toEqual(
        `⚠️ Superface server responded with error: ${mockServerResponse.name}: ${mockServerResponse.message}\n`
      );
    });

    it('calls getUserInfo correctly, unknown error', async () => {
      const mockErr = new Error('test');
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'getUserInfo')
        .mockRejectedValue(mockErr);

      await expect(Whoami.run([])).rejects.toEqual(
        new CLIError('❌ Error: test')
      );
      expect(getInfoSpy).toHaveBeenCalled();
      expect(stderr.output).toEqual('');
      expect(stdout.output).toEqual('');
    });
  });
});
