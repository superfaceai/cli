import { CLIError } from '@oclif/errors';
import {
  CLILoginResponse,
  ServiceClient,
  VerificationStatus,
  VerifyResponse,
} from '@superfaceai/service-client';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import inquirer from 'inquirer';
import * as open from 'open';

import {
  // fetchVerificationUrl,
  // initLogin,
  SuperfaceClient,
} from '../common/http';
import { login } from './login';

jest.mock('@superfaceai/service-client');

jest.mock('../common/http', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/http'),
  initLogin: jest.fn(),
  fetchVerificationUrl: jest.fn(),
}));

//Mock inquirer
jest.mock('inquirer');

//Mock open
jest.mock('open');

class MockChildProcess extends EventEmitter {
  constructor() {
    super();
  }
}
describe('Login logic', () => {
  const stderr = jest.fn();
  const stdout = jest.fn();

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('calling login', () => {
    const mockVerifyResponse: VerifyResponse = {
      verificationStatus: VerificationStatus.CONFIRMED,
      authToken: {
        access_token: 'stub',
        token_type: '',
        refresh_token: 'stub',
        expires_in: 1,
      },
    };

    const mockInitResponse: CLILoginResponse = {
      success: true,
      verifyUrl: 'https://superface.ai/auth/cli/verify?token=stub',
      browserUrl: 'https://superface.ai/auth/cli/browser?code=stub',
      expiresAt: new Date(),
    };

    describe('signing in using browser', () => {
      const initSpy = jest.spyOn(ServiceClient.prototype, 'cliLogin');

      const verifySpy = jest.spyOn(ServiceClient.prototype, 'verifyCliLogin');

      beforeEach(() => {
        jest
          .spyOn(SuperfaceClient, 'getClient')
          .mockImplementation(() => new ServiceClient());
        jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ open: true });
        initSpy.mockResolvedValue(mockInitResponse);

        verifySpy.mockResolvedValue(mockVerifyResponse);
      });

      it('signs in user using prompt and browser', async () => {
        jest
          .spyOn(open, 'default')
          .mockResolvedValue(new MockChildProcess() as ChildProcess);

        await expect(
          login({ logCb: stdout, warnCb: stderr })
        ).resolves.toBeUndefined();

        expect(initSpy).toHaveBeenCalledTimes(1);
        expect(verifySpy).toHaveBeenCalledTimes(1);
        expect(verifySpy).toHaveBeenCalledWith(mockInitResponse.verifyUrl, {
          pollingTimeoutSeconds: 3600,
        });

        expect(stderr).not.toHaveBeenCalled();
        expect(stdout).not.toHaveBeenCalled();
      });

      it('signs in user using prompt and browser - shows url on open browser error', async () => {
        const childProcess = new MockChildProcess();
        const mockErrorMessage = 'mock error';

        jest
          .spyOn(open, 'default')
          .mockResolvedValue(childProcess as ChildProcess);

        await expect(
          login({ logCb: stdout, warnCb: stderr })
        ).resolves.toBeUndefined();

        //Browser emits error
        childProcess.emit('error', { message: mockErrorMessage });

        expect(initSpy).toHaveBeenCalledTimes(1);
        expect(verifySpy).toHaveBeenCalledTimes(1);
        expect(verifySpy).toHaveBeenCalledWith(mockInitResponse.verifyUrl, {
          pollingTimeoutSeconds: 3600,
        });

        expect(stderr).toHaveBeenCalledWith(mockErrorMessage);
        expect(stderr).toHaveBeenCalledWith(
          `Please open url: ${mockInitResponse.browserUrl} in your browser to continue with login.`
        );
        expect(stdout).not.toHaveBeenCalled();
      });

      it('signs in user using prompt and browser - show url when browser is closed', async () => {
        const childProcess = new MockChildProcess();

        jest
          .spyOn(open, 'default')
          .mockResolvedValue(childProcess as ChildProcess);

        await expect(
          login({ logCb: stdout, warnCb: stderr })
        ).resolves.toBeUndefined();

        //Browser emits error
        childProcess.emit('close');

        expect(initSpy).toHaveBeenCalledTimes(1);
        expect(verifySpy).toHaveBeenCalledTimes(1);
        expect(verifySpy).toHaveBeenCalledWith(mockInitResponse.verifyUrl, {
          pollingTimeoutSeconds: 3600,
        });

        expect(stderr).toHaveBeenCalledWith(
          `Please open url: ${mockInitResponse.browserUrl} in your browser to continue with login.`
        );
        expect(stdout).not.toHaveBeenCalled();
      });
    });

    it('signs in user using prompt without browser', async () => {
      jest
        .spyOn(SuperfaceClient, 'getClient')
        .mockImplementation(() => new ServiceClient());
      const initSpy = jest
        .spyOn(ServiceClient.prototype, 'cliLogin')
        .mockResolvedValue(mockInitResponse);
      const verifySpy = jest
        .spyOn(ServiceClient.prototype, 'verifyCliLogin')
        .mockResolvedValue(mockVerifyResponse);

      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ open: false });

      jest
        .spyOn(open, 'default')
        .mockResolvedValue(new MockChildProcess() as ChildProcess);

      await expect(
        login({ logCb: stdout, warnCb: stderr })
      ).resolves.toBeUndefined();

      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).toHaveBeenCalledWith(mockInitResponse.verifyUrl, {
        pollingTimeoutSeconds: 3600,
      });
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledWith(
        `Please open url: ${mockInitResponse.browserUrl} in your browser to continue with login.`
      );
    });

    it('signs in user with force flag', async () => {
      jest
        .spyOn(SuperfaceClient, 'getClient')
        .mockImplementation(() => new ServiceClient());
      const initSpy = jest
        .spyOn(ServiceClient.prototype, 'cliLogin')
        .mockResolvedValue(mockInitResponse);
      const verifySpy = jest
        .spyOn(ServiceClient.prototype, 'verifyCliLogin')
        .mockResolvedValue(mockVerifyResponse);

      const promptSpy = jest.spyOn(inquirer, 'prompt');

      const openSpy = jest.spyOn(open, 'default');

      await expect(
        login({ logCb: stdout, warnCb: stderr, force: true })
      ).resolves.toBeUndefined();

      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).toHaveBeenCalledWith(mockInitResponse.verifyUrl, {
        pollingTimeoutSeconds: 3600,
      });
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledWith(
        `Please open url: ${mockInitResponse.browserUrl} in your browser to continue with login.`
      );
      expect(promptSpy).not.toHaveBeenCalled();
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('throws error on unsuccessful verify - wrong status', async () => {
      const mockVerifyResponse: VerifyResponse = {
        verificationStatus: VerificationStatus.EXPIRED,
      };
      jest
        .spyOn(SuperfaceClient, 'getClient')
        .mockImplementation(() => new ServiceClient());
      const initSpy = jest
        .spyOn(ServiceClient.prototype, 'cliLogin')
        .mockResolvedValue(mockInitResponse);
      const verifySpy = jest
        .spyOn(ServiceClient.prototype, 'verifyCliLogin')
        .mockResolvedValue(mockVerifyResponse);

      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ open: false });

      jest
        .spyOn(open, 'default')
        .mockResolvedValue(new MockChildProcess() as ChildProcess);

      const loginSpy = jest.spyOn(ServiceClient.prototype, 'login');

      await expect(login({ logCb: stdout, warnCb: stderr })).rejects.toEqual(
        new CLIError(
          `❌ Unable to get auth token, request ended with status: ${VerificationStatus.EXPIRED}`
        )
      );

      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).toHaveBeenCalledWith(mockInitResponse.verifyUrl, {
        pollingTimeoutSeconds: 3600,
      });
      expect(loginSpy).not.toHaveBeenCalled();
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledWith(
        `Please open url: ${mockInitResponse.browserUrl} in your browser to continue with login.`
      );
    });

    it('throws error on unsuccessful verify - missing auth token', async () => {
      const mockVerifyResponse: VerifyResponse = {
        verificationStatus: VerificationStatus.CONFIRMED,
      };

      jest
        .spyOn(SuperfaceClient, 'getClient')
        .mockImplementation(() => new ServiceClient());
      const initSpy = jest
        .spyOn(ServiceClient.prototype, 'cliLogin')
        .mockResolvedValue(mockInitResponse);
      const verifySpy = jest
        .spyOn(ServiceClient.prototype, 'verifyCliLogin')
        .mockResolvedValue(mockVerifyResponse);

      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ open: false });

      jest
        .spyOn(open, 'default')
        .mockResolvedValue(new MockChildProcess() as ChildProcess);

      const loginSpy = jest.spyOn(ServiceClient.prototype, 'login');

      await expect(login({ logCb: stdout, warnCb: stderr })).rejects.toEqual(
        new CLIError(
          `❌ Request ended with status: ${VerificationStatus.CONFIRMED} but does not contain auth token`
        )
      );

      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).toHaveBeenCalledWith(mockInitResponse.verifyUrl, {
        pollingTimeoutSeconds: 3600,
      });
      expect(loginSpy).not.toHaveBeenCalled();
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledWith(
        `Please open url: ${mockInitResponse.browserUrl} in your browser to continue with login.`
      );
    });

    it('throws error on unsuccessful init with detail', async () => {
      const mockInitResponse: CLILoginResponse = {
        success: false,
        title: 'mock title',
        detail: 'mock detail',
      };
      jest
        .spyOn(SuperfaceClient, 'getClient')
        .mockImplementation(() => new ServiceClient());
      const initSpy = jest
        .spyOn(ServiceClient.prototype, 'cliLogin')
        .mockResolvedValue(mockInitResponse);

      await expect(login({ logCb: stdout, warnCb: stderr })).rejects.toEqual(
        new CLIError(
          `❌ Attempt to login ended with: ${mockInitResponse.title}: ${
            mockInitResponse.detail || ''
          }`
        )
      );

      expect(initSpy).toHaveBeenCalledTimes(1);
    });

    it('throws error on unsuccessful init without detail', async () => {
      const mockInitResponse: CLILoginResponse = {
        success: false,
        title: 'mock title',
      };
      jest
        .spyOn(SuperfaceClient, 'getClient')
        .mockImplementation(() => new ServiceClient());
      const initSpy = jest
        .spyOn(ServiceClient.prototype, 'cliLogin')
        .mockResolvedValue(mockInitResponse);

      await expect(login({ logCb: stdout, warnCb: stderr })).rejects.toEqual(
        new CLIError(
          `❌ Attempt to login ended with: ${mockInitResponse.title}`
        )
      );

      expect(initSpy).toHaveBeenCalledTimes(1);
    });
  });
});
