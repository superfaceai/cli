import { SuperJson } from '@superfaceai/one-sdk';
import { DEFAULT_PROFILE_VERSION } from '@superfaceai/parser';
import { getLocal } from 'mockttp';
import { join as joinPath } from 'path';

import { composeUsecaseName } from '../common';
import { mkdir, readFile, rimraf } from '../common/io';
import * as mapTemplate from '../templates/map';
import * as profileTemplate from '../templates/profile';
import * as providerTemplate from '../templates/provider';
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
    await mockResponsesForProfile(mockServer, 'communication/send-email');
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

      const result = await execCLI(
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

      const profileFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(profileFile).toEqual(
        [
          profileTemplate.header(
            documentName,
            DEFAULT_PROFILE_VERSION.toString()
          ),
          profileTemplate.empty(composeUsecaseName(documentName)),
        ].join('')
      );

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

      const result = await execCLI(
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

      const profileFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(profileFile).toEqual(
        [
          profileTemplate.header(
            documentName,
            DEFAULT_PROFILE_VERSION.toString()
          ),
          profileTemplate.empty('SendSMS'),
        ].join('')
      );

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

      const result = await execCLI(
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

      const profileFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(profileFile).toEqual(
        [
          profileTemplate.header(
            documentName,
            DEFAULT_PROFILE_VERSION.toString()
          ),
          ...[
            profileTemplate.empty('ReceiveSMS'),
            profileTemplate.empty('SendSMS'),
          ],
        ].join('')
      );

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
      documentName = 'communication/send-email';
      provider = 'twilio';

      const result = await execCLI(
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

      const createdFile = await readFile(
        joinPath(tempDir, `${documentName}.${provider}.suma`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          mapTemplate.header(documentName, provider, '1.0'),
          mapTemplate.empty('SendEmail'),
        ].join('')
      );

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
      documentName = 'communication/send-email';
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

      let createdFile = await readFile(
        joinPath(tempDir, `${documentName}.${provider}.bugfix.suma`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          mapTemplate.header(documentName, provider, '1.0', 'bugfix'),
          ...[mapTemplate.empty('SendSMS'), mapTemplate.empty('ReciveSMS')],
        ].join('')
      );

      createdFile = await readFile(
        joinPath(tempDir, `${documentName}.${secondProvider}.bugfix.suma`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          mapTemplate.header(documentName, secondProvider, '1.0', 'bugfix'),
          ...[mapTemplate.empty('SendSMS'), mapTemplate.empty('ReciveSMS')],
        ].join('')
      );

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
      documentName = 'communication/send-email';
      provider = 'twilio';

      const result = await execCLI(
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

      let createdFile = await readFile(
        joinPath(tempDir, `${documentName}.${provider}.suma`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          mapTemplate.header(documentName, provider, '1.0'),
          mapTemplate.empty('SendSMS'),
        ].join('')
      );

      createdFile = await readFile(
        joinPath(tempDir, `${provider}.provider.json`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(providerTemplate.empty(provider));

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
      documentName = 'communication/send-email';
      provider = 'twilio';

      const result = await execCLI(
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
      const createdFile = await readFile(
        joinPath(tempDir, `${documentName}.${provider}.suma`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          mapTemplate.header(documentName, provider, '1.0'),
          ...[mapTemplate.empty('ReceiveSMS'), mapTemplate.empty('SendSMS')],
        ].join('')
      );

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

      const result = await execCLI(
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
      let createdFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );

      expect(createdFile).toEqual(
        [
          profileTemplate.header(
            documentName,
            DEFAULT_PROFILE_VERSION.toString()
          ),
          profileTemplate.empty('Service'),
        ].join('')
      );

      createdFile = await readFile(
        joinPath(tempDir, `${documentName}.${provider}.suma`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          mapTemplate.header(documentName, provider, '1.0'),
          mapTemplate.empty('Service'),
        ].join('')
      );

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

      const result = await execCLI(
        tempDir,
        [
          'create',
          '--profileId',
          documentName,
          '-u',
          'SendSMS',
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
      let createdFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          profileTemplate.header(
            documentName,
            DEFAULT_PROFILE_VERSION.toString()
          ),
          profileTemplate.empty('SendSMS'),
        ].join('')
      );

      createdFile = await readFile(
        joinPath(tempDir, `${documentName}.${provider}.suma`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          mapTemplate.header(documentName, provider, '1.0'),
          mapTemplate.empty('SendSMS'),
        ].join('')
      );

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

      const result = await execCLI(
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

      let createdFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          profileTemplate.header(
            documentName,
            DEFAULT_PROFILE_VERSION.toString()
          ),
          ...[
            profileTemplate.empty('SendSMS'),
            profileTemplate.empty('ReceiveSMS'),
          ],
        ].join('')
      );

      createdFile = await readFile(
        joinPath(tempDir, `${documentName}.${provider}.suma`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          mapTemplate.header(documentName, provider, '1.0'),
          ...[mapTemplate.empty('SendSMS'), mapTemplate.empty('ReceiveSMS')],
        ].join('')
      );

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

      const result = await execCLI(
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

      let createdFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          profileTemplate.header(documentName, '1.1.0-rev133'),
          ...[
            profileTemplate.empty('SendSMS'),
            profileTemplate.empty('ReceiveSMS'),
          ],
        ].join('')
      );

      createdFile = await readFile(
        joinPath(tempDir, `${documentName}.${provider}.bugfix.suma`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          mapTemplate.header(documentName, provider, '1.1-rev133', 'bugfix'),
          ...[mapTemplate.empty('SendSMS'), mapTemplate.empty('ReceiveSMS')],
        ].join('')
      );

      createdFile = await readFile(
        joinPath(tempDir, `${documentName}.${secondProvider}.bugfix.suma`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          mapTemplate.header(
            documentName,
            secondProvider,
            '1.1-rev133',
            'bugfix'
          ),
          ...[mapTemplate.empty('SendSMS'), mapTemplate.empty('ReceiveSMS')],
        ].join('')
      );

      createdFile = await readFile(
        joinPath(tempDir, `${provider}.provider.json`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(providerTemplate.empty(provider));

      createdFile = await readFile(
        joinPath(tempDir, `${secondProvider}.provider.json`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(providerTemplate.empty(secondProvider));

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

  //Profile & map & provider
  it('creates profile with version, map with multiple usecases and variant, provider and file names', async () => {
    documentName = 'sms/service';
    provider = 'twilio';
    const mockProfileFileName = 'mockProfile';
    const mockMapFileName = 'mockMap';
    const mockProviderFileName = 'mockProvider';

    const result = await execCLI(
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
        '--profile',
        '--map',
        '--provider',
        '--mapFileName',
        mockMapFileName,
        '--profileFileName',
        mockProfileFileName,
        '--providerFileName',
        mockProviderFileName,
      ],
      mockServer.url,
      {
        inputs: [{ value: ENTER, timeout: 1000 }],
      }
    );
    expect(result.stdout).toMatch(
      `-> Created ${mockProfileFileName}.supr (name = "${documentName}", version = "1.1.0-rev133")`
    );
    expect(result.stdout).toMatch(
      `-> Created ${mockMapFileName}.suma (profile = "${documentName}@1.1-rev133", provider = "${provider}")`
    );
    expect(result.stdout).toMatch(`-> Created ${mockProviderFileName}.json`);

    let createdFile = await readFile(
      joinPath(tempDir, `${mockProfileFileName}.supr`),
      { encoding: 'utf-8' }
    );
    expect(createdFile).toEqual(
      [
        profileTemplate.header(documentName, '1.1.0-rev133'),
        ...[
          profileTemplate.empty('SendSMS'),
          profileTemplate.empty('ReceiveSMS'),
        ],
      ].join('')
    );

    createdFile = await readFile(joinPath(tempDir, `${mockMapFileName}.suma`), {
      encoding: 'utf-8',
    });
    expect(createdFile).toEqual(
      [
        mapTemplate.header(documentName, provider, '1.1-rev133', 'bugfix'),
        ...[mapTemplate.empty('SendSMS'), mapTemplate.empty('ReceiveSMS')],
      ].join('')
    );

    createdFile = await readFile(
      joinPath(tempDir, `${mockProviderFileName}.json`),
      { encoding: 'utf-8' }
    );
    expect(createdFile).toEqual(providerTemplate.empty(provider));

    const superJson = (
      await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
    ).unwrap();

    expect(superJson.normalized).toEqual({
      profiles: {
        [documentName]: {
          file: `../${mockProfileFileName}.supr`,
          defaults: {},
          priority: [provider],
          providers: {
            [provider]: {
              defaults: {},
              file: `../${mockMapFileName}.suma`,
            },
          },
        },
      },
      providers: {
        [provider]: {
          file: `../${mockProviderFileName}.json`,
          security: [],
        },
      },
    });
  }, 20000);
});
