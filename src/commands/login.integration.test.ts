import { AuthToken } from '@superfaceai/service-client';
import { getLocal } from 'mockttp';
import { Netrc } from 'netrc-parser';
import { join as joinPath } from 'path';

import { ContentType, InitLoginResponse } from '../common/http';
import { mkdir, rimraf } from '../common/io';
import { ENTER, execCLI, setUpTempDir } from '../test/utils';

const mockServer = getLocal();

describe('Login CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  let tempDir: string;

  const netRc = new Netrc();
  let originalNetrcRecord: { baseUrl?: string; password?: string };
  const mockRefreshToken = 'RT';

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
    await mockServer.start();
    //Load existing netrc
    await netRc.load();
    if (netRc.machines[mockServer.url]) {
      originalNetrcRecord = netRc.machines[mockServer.url];
    }
  });
  beforeEach(async () => {
    tempDir = await setUpTempDir(TEMP_PATH);
  });

  afterEach(async () => {
    await rimraf(tempDir);
  });

  afterAll(async () => {
    //If there was a value keep it
    if (originalNetrcRecord) {
      netRc.machines[mockServer.url] = originalNetrcRecord;
    } else {
      delete netRc.machines[mockServer.url];
    }
    await netRc.save();

    await mockServer.stop();
  });
  describe('when logging in', () => {
    it('logs in when netrc is empty', async () => {
      netRc.machines[mockServer.url] = {};

      const mockInitLoginResponse: InitLoginResponse = {
        verify_url: '/auth/cli/verify?token=stub',
        browser_url: 'https://superface.ai/auth/cli/browser?code=stub',
        expires_at: '2022-01-01T00:00:00.000Z',
      };

      const mockAuthToken: AuthToken = {
        refresh_token: mockRefreshToken,
        scope: 'mock scope',
        access_token: 'AT',
        token_type: 'cli',
        expires_in: 0,
      };

      await mockServer
        .post('/auth/cli')
        .withHeaders({ 'Content-Type': ContentType.JSON })
        .thenJson(200, mockInitLoginResponse);

      await mockServer
        .get('/auth/cli/verify')
        .withQuery({ token: 'stub' })
        .withHeaders({ 'Content-Type': ContentType.JSON })
        .thenJson(200, mockAuthToken);

      const result = await execCLI(tempDir, ['login'], mockServer.url, {
        inputs: [
          //Do not open browser
          { value: 'n', timeout: 3000 },
          { value: ENTER, timeout: 500 },
        ],
      });

      expect(result.stdout).toContain(
        `Do you want to open browser with superface login page?`
      );
      expect(result.stdout).toContain(
        `Please open url: ${mockInitLoginResponse.browser_url} in your browser to continue with login.`
      );
      expect(result.stdout).toContain('Logged in');

      const savedNetRc = new Netrc();
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
      const oldRefreshToken = 'oldRT';
      netRc.machines[mockServer.url] = { password: oldRefreshToken };

      const mockInitLoginResponse: InitLoginResponse = {
        verify_url: '/auth/cli/verify?token=stub',
        browser_url: 'https://superface.ai/auth/cli/browser?code=stub',
        expires_at: '2022-01-01T00:00:00.000Z',
      };

      const mockAuthToken: AuthToken = {
        refresh_token: mockRefreshToken,
        scope: 'mock scope',
        access_token: 'AT',
        token_type: 'cli',
        expires_in: 0,
      };

      await mockServer
        .post('/auth/cli')
        .withHeaders({ 'Content-Type': ContentType.JSON })
        .thenJson(200, mockInitLoginResponse);

      await mockServer
        .get('/auth/cli/verify')
        .withQuery({ token: 'stub' })
        .withHeaders({ 'Content-Type': ContentType.JSON })
        .thenJson(200, mockAuthToken);

      const result = await execCLI(tempDir, ['login'], mockServer.url, {
        inputs: [
          //Do not open browser
          { value: 'n', timeout: 3000 },
          { value: ENTER, timeout: 500 },
        ],
      });
      expect(result.stdout).toContain('Already logged in, logging out');
      expect(result.stdout).toContain(
        `Do you want to open browser with superface login page?`
      );
      expect(result.stdout).toContain(
        `Please open url: ${mockInitLoginResponse.browser_url} in your browser to continue with login.`
      );
      expect(result.stdout).toContain('Logged in');

      const savedNetRc = new Netrc();
      await savedNetRc.load();
      expect(savedNetRc.machines[mockServer.url]).not.toBeUndefined();
      expect(savedNetRc.machines[mockServer.url].password).toEqual(
        mockRefreshToken
      );
      expect(savedNetRc.machines[mockServer.url].baseUrl).toEqual(
        mockServer.url
      );
    });
  });
});
