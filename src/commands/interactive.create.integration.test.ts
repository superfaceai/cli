import { SuperJson } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import { join as joinPath } from 'path';

import { composeUsecaseName, DEFAULT_PROFILE_VERSION_STR } from '../common';
import { mkdir, readFile, rimraf } from '../common/io';
import { messages } from '../common/messages';
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

describe('Interactive create CLI command', () => {
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
    it('creates profile with one usecase (with usecase name from cli)', async () => {
      documentName = 'sendsms';

      const result = await execCLI(tempDir, ['create', '-i'], mockServer.url, {
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
        messages.createProfile(`${documentName}@1.0.0`, `${documentName}.supr`)
      );

      const profileFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(profileFile).toEqual(
        [
          profileTemplate.header(documentName, DEFAULT_PROFILE_VERSION_STR),
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
      documentName = 'communication/send-email';

      const result = await execCLI(
        tempDir,
        ['create', '-u', 'SendUserEmail', '-i'],
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
        messages.createProfile(`${documentName}@1.0.0`, `${documentName}.supr`)
      );
      const profileFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(profileFile).toEqual(
        [
          profileTemplate.header(documentName, DEFAULT_PROFILE_VERSION_STR),
          profileTemplate.empty('SendUserEmail'),
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
        messages.createProfile(`${documentName}@1.0.0`, `${documentName}.supr`)
      );

      const profileFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(profileFile).toEqual(
        [
          profileTemplate.header(documentName, DEFAULT_PROFILE_VERSION_STR),
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
    }, 30000);

    it('creates map with one usecase (with usecase name from cli)', async () => {
      documentName = 'communication/send-email';
      provider = 'twilio';

      const result = await execCLI(tempDir, ['create', '-i'], mockServer.url, {
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
        messages.createMap(
          `${documentName}@1.0`,
          provider,
          `${documentName}.${provider}.suma`
        )
      );
      expect(result.stdout).not.toContain(
        messages.createProvider(provider, `${provider}.provider.json`)
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
    }, 30000);

    it('creates map with one usecase and with provider', async () => {
      documentName = 'communication/send-email';
      provider = 'twilio';

      const result = await execCLI(
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
        messages.createMap(
          `${documentName}@1.0`,
          provider,
          `${documentName}.${provider}.suma`
        )
      );
      expect(result.stdout).toContain(
        messages.createProvider(provider, `${provider}.provider.json`)
      );

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
            parameters: {},
          },
        },
      });
    }, 30000);

    it('creates map with mutiple usecases', async () => {
      documentName = 'communication/send-email';
      provider = 'twilio';

      const result = await execCLI(
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
        messages.createMap(
          `${documentName}@1.0`,
          provider,
          `${documentName}.${provider}.suma`
        )
      );
      expect(result.stdout).not.toContain(
        messages.createProvider(provider, `${provider}.provider.json`)
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
    }, 30000);

    it('creates profile & map with one usecase (with usecase name from cli)', async () => {
      documentName = 'communication/send-email';
      provider = 'twilio';

      const result = await execCLI(tempDir, ['create', '-i'], mockServer.url, {
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
        messages.createProfile(`${documentName}@1.0.0`, `${documentName}.supr`)
      );
      expect(result.stdout).toContain(
        messages.createMap(
          `${documentName}@1.0`,
          provider,
          `${documentName}.${provider}.suma`
        )
      );
      expect(result.stdout).not.toContain(
        messages.createProvider(provider, `${provider}.provider.json`)
      );
      let createdFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          profileTemplate.header(documentName, DEFAULT_PROFILE_VERSION_STR),
          profileTemplate.empty('SendEmail'),
        ].join('')
      );

      createdFile = await readFile(
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
      documentName = 'communication/send-email';
      provider = 'twilio';

      const result = await execCLI(
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
        messages.createProfile(`${documentName}@1.0.0`, `${documentName}.supr`)
      );
      expect(result.stdout).toContain(
        messages.createMap(
          `${documentName}@1.0`,
          provider,
          `${documentName}.${provider}.suma`
        )
      );
      expect(result.stdout).not.toContain(
        messages.createProvider(provider, `${provider}.provider.json`)
      );

      let createdFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          profileTemplate.header(documentName, DEFAULT_PROFILE_VERSION_STR),
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
    }, 30000);

    it('creates profile & map with multiple usecases', async () => {
      documentName = 'communication/send-email';
      provider = 'twilio';

      const result = await execCLI(
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
        messages.createProfile(`${documentName}@1.0.0`, `${documentName}.supr`)
      );
      expect(result.stdout).toMatch(
        messages.createMap(
          `${documentName}@1.0`,
          provider,
          `${documentName}.${provider}.suma`
        )
      );
      expect(result.stdout).not.toMatch(
        messages.createProvider(provider, `${provider}.provider.json`)
      );

      let createdFile = await readFile(
        joinPath(tempDir, `${documentName}.supr`),
        { encoding: 'utf-8' }
      );
      expect(createdFile).toEqual(
        [
          profileTemplate.header(documentName, DEFAULT_PROFILE_VERSION_STR),
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
    }, 30000);
  });
});
