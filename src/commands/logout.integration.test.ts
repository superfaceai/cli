import { getLocal } from 'mockttp';
import { Netrc } from 'netrc-parser';
import { join as joinPath } from 'path';

import { mkdir, rimraf } from '../common/io';
import { messages } from '../common/messages';
import { execCLI, setUpTempDir } from '../test/utils';

const mockServer = getLocal();

describe('Logout CLI command', () => {
  // File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  let tempDir: string;
  let NETRC_FILENAME: string;

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
  });

  beforeEach(async () => {
    await mockServer.start();

    // Test specific netrc
    tempDir = await setUpTempDir(TEMP_PATH, true);
    NETRC_FILENAME = '.netrc';
  });

  afterEach(async () => {
    await rimraf(tempDir);

    await mockServer.stop();
  });

  describe('when running logout command', () => {
    it('logs out user', async () => {
      // Set mock refresh token in netrc
      const netRc = new Netrc(joinPath(tempDir, NETRC_FILENAME));
      await netRc.load();
      netRc.machines[mockServer.url] = { password: 'rt' };
      await netRc.save();

      await mockServer.delete('/auth/signout').thenJson(200, {});
      const result = await execCLI(tempDir, ['logout'], mockServer.url, {
        env: { NETRC_FILEPATH: NETRC_FILENAME },
      });

      expect(result.stdout).toContain(messages.loggoutSuccessful());

      const savedNetRc = new Netrc(joinPath(tempDir, NETRC_FILENAME));
      await savedNetRc.load();
      expect(savedNetRc.machines[mockServer.url].password).toBeUndefined();
    });

    it('returns warning if user is not logged in', async () => {
      await mockServer.delete('/auth/signout').thenJson(401, {});

      const result = await execCLI(tempDir, ['logout'], mockServer.url);

      expect(result.stdout).toContain(
        messages.superfaceServerError(
          'Error',
          "No session found, couldn't log out"
        )
      );
    });
  });
});
