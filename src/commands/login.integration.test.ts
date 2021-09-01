import {
  AuthToken,
  CLILoginResponse,
  VerificationStatus,
} from '@superfaceai/service-client';
import { getLocal } from 'mockttp';
import { Netrc } from 'netrc-parser';
import { join as joinPath } from 'path';

import { mkdir, rimraf } from '../common/io';
import {
  ENTER,
  execCLI,
  mockResponsesForLogin,
  setUpTempDir,
} from '../test/utils';

const mockServer = getLocal();

describe('Login CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  let tempDir: string;
  const mockRefreshToken = 'RT';
  let NETRC_FILENAME: string;

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
  });
  beforeEach(async () => {
    await mockServer.start();
    //Test specific netrc
    tempDir = await setUpTempDir(TEMP_PATH, true);
    NETRC_FILENAME = '.netrc';
  });

  afterEach(async () => {
    await rimraf(tempDir);
    await mockServer.stop();
  });

  describe('when logging in', () => {
    it('logs in when netrc is empty', async () => {
      const mockInitLoginResponse: CLILoginResponse = {
        success: true,
        verifyUrl: `${mockServer.url}/auth/cli/verify?token=stub`,
        browserUrl: 'https://superface.ai/auth/cli/browser?code=stub',
        expiresAt: new Date(),
      };

      const mockAuthToken: AuthToken = {
        refresh_token: mockRefreshToken,
        scope: 'mock scope',
        access_token: 'AT',
        token_type: 'cli',
        expires_in: 0,
      };

      await mockResponsesForLogin(mockServer, mockInitLoginResponse, {
        authToken: mockAuthToken,
      });

      const result = await execCLI(tempDir, ['login'], mockServer.url, {
        env: { NETRC_FILEPATH: NETRC_FILENAME },
        inputs: [
          //Do not open browser
          { value: 'n', timeout: 3000 },
          { value: ENTER, timeout: 500 },
        ],
      });

      expect(result.stdout).toContain(
        `Do you want to open browser with Superface login page?`
      );
      expect(result.stdout).toContain(
        `Please open url: ${mockInitLoginResponse.browserUrl} in your browser to continue with login.`
      );
      expect(result.stdout).toContain('Logged in');

      const savedNetRc = new Netrc(joinPath(tempDir, NETRC_FILENAME));
      await savedNetRc.load();
      expect(savedNetRc.machines[mockServer.url]).not.toBeUndefined();
      expect(savedNetRc.machines[mockServer.url].password).toEqual(
        mockRefreshToken
      );
      expect(savedNetRc.machines[mockServer.url].baseUrl).toEqual(
        mockServer.url
      );
    });

    it('logs in when netrc is not empty', async () => {
      //Set mock refresh token in netrc
      const netRc = new Netrc(joinPath(tempDir, NETRC_FILENAME));
      await netRc.load();
      netRc.machines[mockServer.url] = { password: 'oldRT' };
      await netRc.save();

      const mockInitLoginResponse: CLILoginResponse = {
        success: true,
        verifyUrl: `${mockServer.url}/auth/cli/verify?token=stub`,
        browserUrl: 'https://superface.ai/auth/cli/browser?code=stub',
        expiresAt: new Date(),
      };

      const mockAuthToken: AuthToken = {
        refresh_token: mockRefreshToken,
        scope: 'mock scope',
        access_token: 'AT',
        token_type: 'cli',
        expires_in: 0,
      };

      await mockResponsesForLogin(mockServer, mockInitLoginResponse, {
        authToken: mockAuthToken,
      });

      const result = await execCLI(tempDir, ['login'], mockServer.url, {
        env: { NETRC_FILEPATH: NETRC_FILENAME },
        inputs: [
          //Do not open browser
          { value: 'n', timeout: 3000 },
          { value: ENTER, timeout: 500 },
        ],
      });
      expect(result.stdout).toContain('Already logged in, logging out');
      expect(result.stdout).toContain(
        `Do you want to open browser with Superface login page?`
      );
      expect(result.stdout).toContain(
        `Please open url: ${mockInitLoginResponse.browserUrl} in your browser to continue with login.`
      );
      expect(result.stdout).toContain('Logged in');

      const savedNetRc = new Netrc(joinPath(tempDir, NETRC_FILENAME));
      await savedNetRc.load();
      expect(savedNetRc.machines[mockServer.url]).not.toBeUndefined();
      expect(savedNetRc.machines[mockServer.url].password).toEqual(
        mockRefreshToken
      );
      expect(savedNetRc.machines[mockServer.url].baseUrl).toEqual(
        mockServer.url
      );
    });

    it('throws init login error without detail', async () => {
      const mockInitLoginResponse: CLILoginResponse = {
        success: false,
        title: 'Mock error',
      };

      const mockAuthToken: AuthToken = {
        refresh_token: mockRefreshToken,
        scope: 'mock scope',
        access_token: 'AT',
        token_type: 'cli',
        expires_in: 0,
      };

      await mockResponsesForLogin(mockServer, mockInitLoginResponse, {
        authToken: mockAuthToken,
      });

      await expect(
        execCLI(tempDir, ['login'], mockServer.url, {
          env: { NETRC_FILEPATH: NETRC_FILENAME },
          inputs: [
            //Do not open browser
            { value: 'n', timeout: 3000 },
            { value: ENTER, timeout: 500 },
          ],
        })
      ).rejects.toEqual(
        expect.stringContaining(`Attempt to login ended with: Mock error`)
      );

      const savedNetRc = new Netrc(joinPath(tempDir, NETRC_FILENAME));
      await savedNetRc.load();
      expect(savedNetRc.machines[mockServer.url]).toBeUndefined();
    });

    it('throws init login error with detail', async () => {
      const mockInitLoginResponse: CLILoginResponse = {
        success: false,
        title: 'Mock error',
        detail: 'detail of error',
      };

      const mockAuthToken: AuthToken = {
        refresh_token: mockRefreshToken,
        scope: 'mock scope',
        access_token: 'AT',
        token_type: 'cli',
        expires_in: 0,
      };

      await mockResponsesForLogin(mockServer, mockInitLoginResponse, {
        authToken: mockAuthToken,
      });

      await expect(
        execCLI(tempDir, ['login'], mockServer.url, {
          env: { NETRC_FILEPATH: NETRC_FILENAME },
          inputs: [
            //Do not open browser
            { value: 'n', timeout: 3000 },
            { value: ENTER, timeout: 500 },
          ],
        })
      ).rejects.toEqual(
        expect.stringContaining(
          `Attempt to login ended with: Mock error: detail of error`
        )
      );

      const savedNetRc = new Netrc(joinPath(tempDir, NETRC_FILENAME));
      await savedNetRc.load();
      expect(savedNetRc.machines[mockServer.url]).toBeUndefined();
    });

    it('throws verify login error on invalid verification status', async () => {
      const mockInitLoginResponse: CLILoginResponse = {
        success: true,
        verifyUrl: `${mockServer.url}/auth/cli/verify?token=stub`,
        browserUrl: 'https://superface.ai/auth/cli/browser?code=stub',
        expiresAt: new Date(),
      };

      await mockResponsesForLogin(mockServer, mockInitLoginResponse, {
        statusCode: 400,
        errStatus: VerificationStatus.EXPIRED,
      });

      await expect(
        execCLI(tempDir, ['login'], mockServer.url, {
          env: { NETRC_FILEPATH: NETRC_FILENAME },
          inputs: [
            //Do not open browser
            { value: 'n', timeout: 3000 },
            { value: ENTER, timeout: 500 },
          ],
        })
      ).rejects.toEqual(
        expect.stringContaining(
          `Unable to get auth token, request ended with status: EXPIRED`
        )
      );

      const savedNetRc = new Netrc(joinPath(tempDir, NETRC_FILENAME));
      await savedNetRc.load();
      expect(savedNetRc.machines[mockServer.url]).toBeUndefined();
    });
  });
});
