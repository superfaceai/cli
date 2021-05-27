import { SuperJson } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import { join as joinPath } from 'path';

import { mkdir, rimraf } from '../common/io';
import {
  execCLI,
  execCliWithInputs,
  mockResponsesForProfile,
  mockResponsesForProvider,
  setUpTempDir,
} from '../test/utils';

const mockServer = getLocal();

describe('Create CLI command', () => {
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

  describe('when configuring new provider', () => {
    it('creates profile with one usecase (with usecase name from cli)', async () => {
      documentName = 'sendsms';

      let result = await execCliWithInputs(
        tempDir,
        ['create', 'profile', documentName],
        mockServer.url,
        //Mock inquier input
        '\x0D'
      );

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
    }, 20000);

    it('creates profile with one usecase', async () => {
      documentName = 'sms/service';

      let result = await execCliWithInputs(
        tempDir,
        ['create', 'profile', documentName, '-u', 'SendSMS'],
        mockServer.url,
        //Mock inquier input
        '\x0D'
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
    }, 20000);

    it('creates profile with multiple usecases', async () => {
      documentName = 'sms/service';

      let result = await execCliWithInputs(
        tempDir,
        ['create', 'profile', documentName, '-u', 'ReceiveSMS', 'SendSMS'],
        mockServer.url,
        //Mock inquier input
        '\x0D'
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
    }, 20000);

    it('creates map with one usecase (with usecase name from cli)', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCliWithInputs(
        tempDir,
        ['create', 'map', documentName, '-p', provider],
        mockServer.url,
        //Mock inquier input
        '\x0D'
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
      expect(superJson.document).toEqual({
        profiles: {
          [documentName]: {
            defaults: {},
            providers: {
              [provider]: {
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
    }, 20000);

    it('creates map with one usecase', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCliWithInputs(
        tempDir,
        ['create', 'map', documentName, '-u', 'SendSMS', '-p', provider],
        mockServer.url,
        //Mock inquier input
        '\x0D'
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

      expect(superJson.document).toEqual({
        profiles: {
          [documentName]: {
            defaults: {},
            providers: {
              [provider]: {
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
    }, 20000);

    it('creates map with mutiple usecases', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCliWithInputs(
        tempDir,
        [
          'create',
          'map',
          documentName,
          '-p',
          provider,
          '-u',
          'ReceiveSMS',
          'SendSMS',
        ],
        mockServer.url,
        //Mock inquier input
        '\x0D'
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

      expect(superJson.document).toEqual({
        profiles: {
          [documentName]: {
            defaults: {},
            providers: {
              [provider]: {
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
    }, 20000);

    it('creates profile & map with one usecase (with usecase name from cli)', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCliWithInputs(
        tempDir,
        ['create', documentName, '-p', provider],
        mockServer.url,
        //Mock inquier input
        '\x0D'
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")`
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")`
      );
      expect(result.stdout).toContain(`-> Created ${provider}.provider.json`);

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

      expect(superJson.document).toEqual({
        profiles: {
          [documentName]: {
            file: `../${documentName}.supr`,
            providers: {
              [provider]: {
                file: `../${documentName}.${provider}.suma`,
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: `../${provider}.provider.json`,
            security: [],
          },
        },
      });
    }, 20000);

    it('creates profile & map with one usecase', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCliWithInputs(
        tempDir,
        ['create', documentName, '-u', 'SendSMS', '-p', 'twilio'],
        mockServer.url,
        //Mock inquier input
        '\x0D'
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")`
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")`
      );
      expect(result.stdout).toContain(`-> Created ${provider}.provider.json`);
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

      expect(superJson.document).toEqual({
        profiles: {
          [documentName]: {
            file: `../${documentName}.supr`,
            providers: {
              [provider]: {
                file: `../${documentName}.${provider}.suma`,
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: `../${provider}.provider.json`,
            security: [],
          },
        },
      });
    }, 20000);

    it('creates profile & map with multiple usecases', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCliWithInputs(
        tempDir,
        ['create', documentName, '-u', 'SendSMS', 'ReceiveSMS', '-p', provider],
        mockServer.url,
        //Mock inquier input
        '\x0D'
      );
      expect(result.stdout).toMatch(
        `-> Created ${documentName}.supr (name = "${documentName}", version = "1.0.0")`
      );
      expect(result.stdout).toMatch(
        `-> Created ${documentName}.${provider}.suma (profile = "${documentName}@1.0", provider = "${provider}")`
      );
      expect(result.stdout).toMatch(`-> Created ${provider}.provider.json`);

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

      expect(superJson.document).toEqual({
        profiles: {
          [documentName]: {
            file: `../${documentName}.supr`,
            providers: {
              [provider]: {
                file: `../${documentName}.${provider}.suma`,
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: `../${provider}.provider.json`,
            security: [],
          },
        },
      });
    }, 20000);
  });
});
