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

  describe('when creating new document', () => {
    //Profile
    it('creates profile with one usecase (with usecase name from cli)', async () => {
      documentName = 'sendsms';

      let result = await execCLI(
        tempDir,
        ['create', '--profileId', documentName, '--profile'],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 2000 }],
        }
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
    }, 30000);

    it('creates profile with one usecase', async () => {
      documentName = 'sms/service';

      let result = await execCLI(
        tempDir,
        ['create', '--profileId', documentName, '-u', 'SendSMS', '--profile'],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 2000 }],
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
        [
          'create',
          '--profileId',
          documentName,
          '-u',
          'ReceiveSMS',
          'SendSMS',
          '--profile',
        ],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 2000 }],
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
    }, 20000);
    //Map
    it('creates map with one usecase (with usecase name from cli)', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(
        tempDir,
        [
          'create',
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '--map',
        ],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 1000 }],
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
    }, 20000);

    it('creates two maps with multiple usecases and variant', async () => {
      documentName = 'sms/service';
      provider = 'twilio';
      const secondProvider = 'tyntec';

      let result = await execCLI(
        tempDir,
        [
          'create',
          '--profileId',
          documentName,
          '--providerName',
          provider,
          secondProvider,
          '-t',
          'bugfix',
          '-u',
          'SendSMS',
          'ReciveSMS',
          '--map',
        ],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 1000 }],
        }
      );
      expect(result.stdout).toContain(
        `-> Created ${documentName}.${provider}.bugfix.suma (profile = "${documentName}@1.0", provider = "${provider}")`
      );
      expect(result.stdout).not.toContain(
        `-> Created ${provider}.bugfix.provider.json`
      );
      expect(result.stdout).not.toContain(
        `-> Created ${secondProvider}.bugfix.provider.json`
      );
      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.${provider}.bugfix.suma`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.${secondProvider}.bugfix.suma`],
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
            priority: [provider, secondProvider],
            providers: {
              [provider]: {
                defaults: {},
                file: `../${documentName}.${provider}.bugfix.suma`,
              },
              [secondProvider]: {
                defaults: {},
                file: `../${documentName}.${secondProvider}.bugfix.suma`,
              },
            },
            version: '0.0.0',
          },
        },
        providers: {},
      });
    }, 20000);
    //Provider
    it('creates one provider', async () => {
      documentName = 'sms/service';
      provider = 'twilio';
      const result = await execCLI(
        tempDir,
        [
          'create',
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '--provider',
        ],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 1000 }],
        }
      );
      expect(result.stdout).toContain(`-> Created ${provider}.provider.json`);

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();
      expect(superJson.normalized).toEqual({
        profiles: {},
        providers: {
          [provider]: {
            file: `../${provider}.provider.json`,
            security: [],
          },
        },
      });
    }, 20000);

    it('creates two providers', async () => {
      documentName = 'sms/service';
      provider = 'twilio';
      const secondProvider = 'tyntec';
      const result = await execCLI(
        tempDir,
        [
          'create',
          '--profileId',
          documentName,
          '--providerName',
          provider,
          secondProvider,
          '--provider',
        ],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 1000 }],
        }
      );
      expect(result.stdout).toContain(`-> Created ${provider}.provider.json`);
      expect(result.stdout).toContain(
        `-> Created ${secondProvider}.provider.json`
      );

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();
      expect(superJson.normalized).toEqual({
        profiles: {},
        providers: {
          [provider]: {
            file: `../${provider}.provider.json`,
            security: [],
          },
          [secondProvider]: {
            file: `../${secondProvider}.provider.json`,
            security: [],
          },
        },
      });
    }, 20000);
    //Map and provider
    it('creates map with one usecase and with provider', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(
        tempDir,
        [
          'create',
          '--profileId',
          documentName,
          '-u',
          'SendSMS',
          '--providerName',
          provider,
          '--map',
          '--provider',
        ],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 1000 }],
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
    }, 20000);

    it('creates map with mutiple usecases', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(
        tempDir,
        [
          'create',
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '-u',
          'ReceiveSMS',
          'SendSMS',
          '--map',
        ],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 1000 }],
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
    }, 20000);
    it('creates profile & map with one usecase (with usecase name from cli)', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(
        tempDir,
        [
          'create',
          '--profileId',
          documentName,
          '--providerName',
          provider,
          '--profile',
          '--map',
        ],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 1000 }],
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
    }, 20000);

    it('creates profile & map with one usecase', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(
        tempDir,
        [
          'create',
          '--profileId',
          documentName,
          '-u',
          'SendSMS',
          '--providerName',
          'twilio',
          '--profile',
          '--map',
        ],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 1000 }],
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
    }, 20000);

    it('creates profile & map with multiple usecases', async () => {
      documentName = 'sms/service';
      provider = 'twilio';

      let result = await execCLI(
        tempDir,
        [
          'create',
          '--profileId',
          documentName,
          '-u',
          'SendSMS',
          'ReceiveSMS',
          '--providerName',
          provider,
          '--profile',
          '--map',
        ],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 1000 }],
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
    }, 20000);
    //Profile & map & provider
    it('creates profile with version, multiple maps with multiple usecases, variant and multiple providers', async () => {
      documentName = 'sms/service';
      provider = 'twilio';
      const secondProvider = 'tyntec';

      let result = await execCLI(
        tempDir,
        [
          'create',
          '--profileId',
          documentName,
          '-v',
          '1.1-rev133',
          '-t',
          'bugfix',
          '-u',
          'SendSMS',
          'ReceiveSMS',
          '--providerName',
          provider,
          secondProvider,
          '--profile',
          '--map',
          '--provider',
        ],
        mockServer.url,
        {
          inputs: [{ value: ENTER, timeout: 1000 }],
        }
      );
      expect(result.stdout).toMatch(
        `-> Created ${documentName}.supr (name = "${documentName}", version = "1.1.0-rev133")`
      );
      expect(result.stdout).toMatch(
        `-> Created ${documentName}.${provider}.bugfix.suma (profile = "${documentName}@1.1-rev133", provider = "${provider}")`
      );
      expect(result.stdout).toMatch(
        `-> Created ${documentName}.${secondProvider}.bugfix.suma (profile = "${documentName}@1.1-rev133", provider = "${secondProvider}")`
      );
      expect(result.stdout).toMatch(`-> Created ${provider}.provider.json`);
      expect(result.stdout).toMatch(
        `-> Created ${secondProvider}.provider.json`
      );

      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.supr`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.${provider}.bugfix.suma`],
        mockServer.url
      );
      expect(result.stdout).toMatch('Detected 0 problems\n');

      result = await execCLI(
        tempDir,
        ['lint', `${documentName}.${secondProvider}.bugfix.suma`],
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
            priority: [provider, secondProvider],
            providers: {
              [provider]: {
                defaults: {},
                file: `../${documentName}.${provider}.bugfix.suma`,
              },
              [secondProvider]: {
                defaults: {},
                file: `../${documentName}.${secondProvider}.bugfix.suma`,
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: `../${provider}.provider.json`,
            security: [],
          },
          [secondProvider]: {
            file: `../${secondProvider}.provider.json`,
            security: [],
          },
        },
      });
    }, 20000);
  });
});
