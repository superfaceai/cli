import { SuperJson } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import { join as joinPath } from 'path';

import { mkdir, rimraf } from '../common/io';
import {
  ENTER,
  execCLI,
  mockResponsesForProfile,
  mockResponsesForProvider,
  setUpTempDir,
} from '../test/utils';

const mockServer = getLocal();

describe('Interactive create CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  let documentName, provider;
  let tempDir: string;

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
    await mockServer.start();
    await mockResponsesForProfile(mockServer, 'starwars/character-information');
    await mockResponsesForProvider(mockServer, 'swapi');
  });
  beforeEach(async () => {
    tempDir = await setUpTempDir(TEMP_PATH);
  });

  afterEach(async () => {
    await rimraf(tempDir);
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  describe('when creating new document', () => {
    it('creates profile with one usecase (with usecase name from cli)', async () => {
      documentName = 'sendsms';

      let result = await execCLI(tempDir, ['create', '-i'], mockServer.url, {
        inputs: [
          //Create profile
          { value: ENTER, timeout: 2000 },
          //Create map
          { value: 'n', timeout: 2000 },
          { value: ENTER, timeout: 200 },
          //Create provider
          { value: 'n', timeout: 2000 },
          { value: ENTER, timeout: 200 },
          //Profile
          { value: documentName, timeout: 2000 },
          { value: ENTER, timeout: 200 },
          //Init superface
          { value: ENTER, timeout: 200 },
        ],
      });

      expect(result.stdout).toMatch(
        `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")`
      );

      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.supr`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual({
        profiles: {
          [documentName]: {
            file: `../${documentName}.supr`,
          },
        },
        providers: {},
      });
    }, 30000);

    it('creates profile with one usecase', async () => {
      documentName = 'sms/service';

      let result = await execCLI(
        tempDir,
        ['create', '-u', 'SendSMS', '-i'],
        mockServer.url,
        {
          inputs: [
            //Create profile
            { value: ENTER, timeout: 2000 },
            //Create map
            { value: 'n', timeout: 2000 },
            { value: ENTER, timeout: 100 },
            //Create provider
            { value: 'n', timeout: 2000 },
            { value: ENTER, timeout: 100 },
            //Profile
            { value: documentName, timeout: 2000 },
            { value: ENTER, timeout: 200 },
            //Init superface
            { value: ENTER, timeout: 500 },
          ],
        }
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")`
      );
      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.supr`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual({
        profiles: {
          [documentName]: {
            file: `../${documentName}.supr`,
          },
        },
        providers: {},
      });
    }, 30000);

    it('creates profile with multiple usecases', async () => {
      documentName = 'sms/service';

      let result = await execCLI(
        tempDir,
        ['create', '-u', 'ReceiveSMS', 'SendSMS', '-i'],
        mockServer.url,
        {
          inputs: [
            //Create profile
            { value: ENTER, timeout: 2000 },
            //Create map
            { value: 'n', timeout: 2000 },
            { value: ENTER, timeout: 200 },
            //Create provider
            { value: 'n', timeout: 2000 },
            { value: ENTER, timeout: 200 },
            //Profile
            { value: documentName, timeout: 2000 },
            { value: ENTER, timeout: 500 },
            //Init superface
            { value: ENTER, timeout: 200 },
          ],
        }
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")`
      );

      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.supr`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual({
        profiles: {
          [documentName]: {
            file: `../${documentName}.supr`,
          },
        },
        providers: {},
      });
    }, 30000);

    it('creates map with one usecase (with usecase name from cli)', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(tempDir, ['create', '-i'], mockServer.url, {
        inputs: [
          //Create profile
          { value: 'n', timeout: 2000 },
          { value: ENTER, timeout: 200 },
          //Create map
          { value: ENTER, timeout: 2000 },
          //Create provider
          { value: 'n', timeout: 2000 },
          { value: ENTER, timeout: 200 },
          //Profile
          { value: documentName, timeout: 2000 },
          { value: ENTER, timeout: 200 },
          //Provider
          { value: provider, timeout: 2000 },
          { value: ENTER, timeout: 200 },
          { value: ENTER, timeout: 200 },
          //Init superface
          { value: ENTER, timeout: 200 },
        ],
      });
      expect(result.stdout).toContain(
        `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")`
      );
      expect(result.stdout).not.toContain(
        `-> Created ${provider}.provider.json`
      );
      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.${provider}.suma`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();
      expect(superJson.normalized).toEqual({
        profiles: {
          [documentName]: {
            defaults: {},
            priority: [provider],
            providers: {
              [provider]: {
                defaults: {},
                file: `../${documentName}.${provider}.suma`,
              },
            },
            version: '0.0.0',
          },
        },
        providers: {},
      });
    }, 30000);

    it('creates map with one usecase and with provider', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(
        tempDir,
        ['create', '-u', 'SendSMS', '-i'],
        mockServer.url,
        {
          inputs: [
            //Create profile
            { value: 'n', timeout: 1000 },
            { value: ENTER, timeout: 200 },
            //Create map
            { value: ENTER, timeout: 1000 },
            //Create provider
            { value: ENTER, timeout: 1000 },
            //Profile
            { value: documentName, timeout: 2000 },
            { value: ENTER, timeout: 200 },
            //Provider
            { value: provider, timeout: 2000 },
            { value: ENTER, timeout: 200 },
            { value: ENTER, timeout: 200 },
            //Init superface
            { value: ENTER, timeout: 200 },
          ],
        }
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")`
      );
      expect(result.stdout).toContain(`-> Created ${provider}.provider.json`);
      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.${provider}.suma`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.normalized).toEqual({
        profiles: {
          [documentName]: {
            defaults: {},
            priority: [provider],
            providers: {
              [provider]: {
                defaults: {},
                file: `../${documentName}.${provider}.suma`,
              },
            },
            version: '0.0.0',
          },
        },
        providers: {
          [provider]: {
            file: `../${provider}.provider.json`,
            security: [],
          },
        },
      });
    }, 30000);

    it('creates map with mutiple usecases', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(
        tempDir,
        ['create', '-u', 'ReceiveSMS', 'SendSMS', '-i'],
        mockServer.url,
        {
          inputs: [
            //Create profile
            { value: 'n', timeout: 1000 },
            { value: ENTER, timeout: 200 },
            //Create map
            { value: ENTER, timeout: 1000 },
            //Create provider
            { value: 'n', timeout: 1000 },
            { value: ENTER, timeout: 200 },
            //Profile
            { value: documentName, timeout: 2000 },
            { value: ENTER, timeout: 200 },
            //Provider
            { value: provider, timeout: 2000 },
            { value: ENTER, timeout: 200 },
            { value: ENTER, timeout: 200 },
            //Init superface
            { value: ENTER, timeout: 200 },
          ],
        }
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")`
      );
      expect(result.stdout).not.toContain(
        `-> Created ${provider}.provider.json`
      );
      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.${provider}.suma`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.normalized).toEqual({
        profiles: {
          [documentName]: {
            defaults: {},
            priority: [provider],
            providers: {
              [provider]: {
                defaults: {},
                file: `../${documentName}.${provider}.suma`,
              },
            },
            version: '0.0.0',
          },
        },
        providers: {},
      });
    }, 30000);

    it('creates profile & map with one usecase (with usecase name from cli)', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(tempDir, ['create', '-i'], mockServer.url, {
        inputs: [
          //Create profile
          { value: ENTER, timeout: 1000 },
          //Create map
          { value: ENTER, timeout: 1000 },
          //Create provider
          { value: 'n', timeout: 1000 },
          { value: ENTER, timeout: 200 },
          //Profile
          { value: documentName, timeout: 2000 },
          { value: ENTER, timeout: 200 },
          //Provider
          { value: provider, timeout: 2000 },
          { value: ENTER, timeout: 200 },
          { value: ENTER, timeout: 200 },
          //Init superface
          { value: ENTER, timeout: 200 },
        ],
      });
      expect(result.stdout).toContain(
        `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")`
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")`
      );
      expect(result.stdout).not.toContain(
        `-> Created ${provider}.provider.json`
      );

      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.supr`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.${provider}.suma`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.normalized).toEqual({
        profiles: {
          [documentName]: {
            file: `../${documentName}.supr`,
            defaults: {},
            priority: [provider],
            providers: {
              [provider]: {
                defaults: {},
                file: `../${documentName}.${provider}.suma`,
              },
            },
          },
        },
        providers: {},
      });
    }, 30000);

    it('creates profile & map with one usecase', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(
        tempDir,
        ['create', '-u', 'SendSMS', '-i'],
        mockServer.url,
        {
          inputs: [
            //Create profile
            { value: ENTER, timeout: 1000 },
            //Create map
            { value: ENTER, timeout: 1000 },
            //Create provider
            { value: 'n', timeout: 1000 },
            { value: ENTER, timeout: 200 },
            //Profile
            { value: documentName, timeout: 2000 },
            { value: ENTER, timeout: 200 },
            //Provider
            { value: provider, timeout: 2000 },
            { value: ENTER, timeout: 200 },
            { value: ENTER, timeout: 200 },
            //Init superface
            { value: ENTER, timeout: 200 },
          ],
        }
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")`
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")`
      );
      expect(result.stdout).not.toContain(
        `-> Created ${provider}.provider.json`
      );
      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.supr`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.${provider}.suma`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.normalized).toEqual({
        profiles: {
          [documentName]: {
            file: `../${documentName}.supr`,
            defaults: {},
            priority: [provider],
            providers: {
              [provider]: {
                defaults: {},
                file: `../${documentName}.${provider}.suma`,
              },
            },
          },
        },
        providers: {},
      });
    }, 30000);

    it('creates profile & map with multiple usecases', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(
        tempDir,
        ['create', '-u', 'SendSMS', 'ReceiveSMS', '-i'],
        mockServer.url,
        {
          inputs: [
            //Create profile
            { value: ENTER, timeout: 2000 },
            //Create map
            { value: ENTER, timeout: 2000 },
            //Create provider
            { value: 'n', timeout: 2000 },
            { value: ENTER, timeout: 500 },
            //Profile
            { value: documentName, timeout: 2000 },
            { value: ENTER, timeout: 500 },
            //Provider
            { value: provider, timeout: 2000 },
            { value: ENTER, timeout: 200 },
            { value: ENTER, timeout: 200 },
            //Init superface
            { value: ENTER, timeout: 200 },
          ],
        }
      );
      expect(result.stdout).toMatch(
        `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")`
      );
      expect(result.stdout).toMatch(
        `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")`
      );
      expect(result.stdout).not.toMatch(`-> Created ${provider}.provider.json`);

      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.supr`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.${provider}.suma`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.normalized).toEqual({
        profiles: {
          [documentName]: {
            file: `../${documentName}.supr`,
            defaults: {},
            priority: [provider],
            providers: {
              [provider]: {
                defaults: {},
                file: `../${documentName}.${provider}.suma`,
              },
            },
          },
        },
        providers: {},
      });
    }, 30000);
  });
});
