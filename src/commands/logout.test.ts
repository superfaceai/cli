import { CLIError } from '@oclif/errors';
import { ServiceClient, ServiceClientError } from '@superfaceai/service-client';

import { messages } from '../common/messages';
import { MockStd, mockStd } from '../test/mock-std';
import Logout from './logout';

describe('Logout CLI command', () => {
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

  describe('when running logout command', () => {
    it('calls signOut correctly, user logged in', async () => {
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'signOut')
        .mockResolvedValue(null);

      await expect(Logout.run([])).resolves.toBeUndefined();
      expect(getInfoSpy).toHaveBeenCalled();
      expect(stderr.output).toContain('');
      expect(stdout.output).toContain(messages.loggoutSuccessfull());
    });

    it('calls getUserInfo correctly, user logged out', async () => {
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'signOut')
        .mockRejectedValue(
          new ServiceClientError("No session found, couldn't log out")
        );

      await expect(Logout.run([])).resolves.toBeUndefined();
      expect(getInfoSpy).toHaveBeenCalled();
      expect(stderr.output).toEqual('');
      expect(stdout.output).toContain(
        messages.superfaceServerError(
          'Error',
          `No session found, couldn't log out`
        )
      );
    });

    it('calls getUserInfo correctly, unknown error', async () => {
      const mockErr = new Error('test');
      const getInfoSpy = jest
        .spyOn(ServiceClient.prototype, 'signOut')
        .mockRejectedValue(mockErr);

      await expect(Logout.run([])).rejects.toEqual(new CLIError('test'));
      expect(getInfoSpy).toHaveBeenCalled();
      expect(stderr.output).toEqual('');
      expect(stdout.output).toEqual('');
    });
  });
});
