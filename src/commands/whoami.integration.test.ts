import { join as joinPath } from 'path';
import { getLocal } from 'mockttp';
import { ServiceApiError } from '@superfaceai/service-client';

// import { Netrc } from 'netrc-parser';
import { mkdir, rimraf } from '../common/io';
import { execCLI, setUpTempDir } from '../test/utils';
import { ContentType } from '../common/http';
import { bold, gray, green, yellow } from 'chalk';

const mockServer = getLocal();

describe('Whoami CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  let tempDir: string;

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
  });
  beforeEach(async () => {
    tempDir = await setUpTempDir(TEMP_PATH);
    await mockServer.start();
  });

  afterEach(async () => {
    await rimraf(tempDir);
    await mockServer.stop();
  });

  describe('when running whoami command', () => {
    it('returns info about logged in user', async () => {
      const mockUserInfo = {
        name: 'jakub.vacek',
        email: 'jakub.vacek@dxheroes.io',
        accounts: [],
      };

      await mockServer
        .get('/id/user')
        .withHeaders({ 'Content-Type': ContentType.JSON })
        .thenJson(200, mockUserInfo);
      const result = await execCLI(tempDir, ['whoami'], mockServer.url);

      expect(result.stdout).toContain(
        gray(
          `🆗 You are logged in as: ${bold(green(mockUserInfo.name))} (${bold(
            green(mockUserInfo.email)
          )})`
        )
      );
    });

    it('returns wrning if user is not logged in', async () => {
      const mockServerResponse = new ServiceApiError({
        status: 401,
        instance: '',
        title: 'Unathorized',
        detail: 'unathorized',
      });

      await mockServer
        .get('/id/user')
        .withHeaders({ 'Content-Type': ContentType.JSON })
        .thenJson(401, mockServerResponse);
      const result = await execCLI(tempDir, ['whoami'], mockServer.url);

      expect(result.stdout.trim()).toEqual(
        yellow('❌ You are not logged in. Please try running "sf login"')
      );
    });
  });
});
