import { ServiceClient } from '@superfaceai/service-client';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import inquirer from 'inquirer';
import * as open from 'open';
import { mocked } from 'ts-jest/utils';

import {
  fetchVerificationUrl,
  initLogin,
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
    it('signs up user using prompt and browser', async () => {
      const mockVerifyResponse = {
        access_token: 'stub',
        token_type: '',
        refresh_token: 'stub',
        expires_in: 1,
      };

      const mockInitResponse = {
        verify_url: 'https://superface.ai/auth/cli/verify?token=stub',
        browser_url: 'https://superface.ai/auth/cli/browser?code=stub',
        expires_at: '2022-01-01T00:00:00.000Z',
      };
      mocked(initLogin).mockResolvedValue(mockInitResponse);
      jest
        .spyOn(inquirer, 'prompt')
        //Create profile
        .mockResolvedValueOnce({ open: true });

      jest
        .spyOn(open, 'default')
        .mockResolvedValue(new MockChildProcess() as ChildProcess);
      mocked(fetchVerificationUrl).mockResolvedValue(mockVerifyResponse);

      const loginSpy = jest.spyOn(ServiceClient.prototype, 'login');
      jest
        .spyOn(SuperfaceClient, 'getClient')
        .mockImplementation(() => new ServiceClient());

      await expect(
        login({ logCb: stdout, warnCb: stderr })
      ).resolves.toBeUndefined();

      expect(initLogin).toHaveBeenCalledTimes(1);
      expect(fetchVerificationUrl).toHaveBeenCalledTimes(1);
      expect(fetchVerificationUrl).toHaveBeenCalledWith(
        mockInitResponse.verify_url
      );
      expect(loginSpy).toHaveBeenCalledWith(mockVerifyResponse);
    });
  });
});
