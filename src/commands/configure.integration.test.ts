import { HttpScheme, SecurityType } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import { join as joinPath } from 'path';

import { ContentType } from '../common/http';
import { exists, mkdir, mkdirQuiet, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import {
  execCLI,
  mockResponsesForProfile,
  mockResponsesForProvider,
  setUpTempDir,
} from '../test/utils';

const mockServer = getLocal();

describe('Configure CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  const profileId = 'starwars/character-information';
  const profileVersion = '1.0.1';
  const provider = 'swapi';
  const providerWithParameters = 'azure-cognitive-services';
  let tempDir: string;

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
    await mockServer.start();
    await mockResponsesForProfile(mockServer, 'starwars/character-information');
    await mockResponsesForProvider(mockServer, 'swapi');
    await mockResponsesForProvider(mockServer, 'azure-cognitive-services');
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
    it('configures provider with security schemes correctly', async () => {
      let result = await execCLI(
        tempDir,
        ['install', 'starwars/character-information'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );

      result = await execCLI(
        tempDir,
        ['configure', provider, '-p', profileId],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        '🆗 All security schemes have been configured successfully.'
      );
      await expect(
        exists(joinPath(tempDir, 'superface', 'super.json'))
      ).resolves.toEqual(true);

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      //Check super.json
      expect(superJson.normalized.providers[provider].security).toEqual([
        {
          id: 'api',
          apikey: `$${provider.toUpperCase()}_API_KEY`,
        },
        {
          id: 'bearer',
          token: `$${provider.toUpperCase()}_TOKEN`,
        },
        {
          id: 'basic',
          username: `$${provider.toUpperCase()}_USERNAME`,
          password: `$${provider.toUpperCase()}_PASSWORD`,
        },
        {
          id: 'digest',
          digest: `$${provider.toUpperCase()}_DIGEST`,
        },
      ]);
      expect(superJson.document.profiles![profileId]).toEqual({
        version: profileVersion,
        priority: [provider],
        providers: { [provider]: {} },
      });
    }, 30000);

    it('configures provider with integration parameters correctly', async () => {
      let result = await execCLI(
        tempDir,
        ['install', 'starwars/character-information'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );

      result = await execCLI(
        tempDir,
        ['configure', providerWithParameters, '-p', profileId],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        '🆗 All security schemes have been configured successfully.'
      );
      expect(result.stdout).toMatch(
        `Provider azure-cognitive-services has integration parameters that must be configured. You can configure them in super.json on path: superface/super.json or set the environment variables as defined below.`
      );
      expect(result.stdout).toMatch(
        '🆗 Parameter version has been configured to use value of environment value "$AZURE_COGNITIVE_SERVICES_VERSION"'
      );
      expect(result.stdout).toContain(
        'Please, configure this environment value.'
      );

      expect(result.stdout).toContain(
        'If you do not set the variable, the default value "v1" will be used.'
      );

      await expect(
        exists(joinPath(tempDir, 'superface', 'super.json'))
      ).resolves.toEqual(true);

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      //Check super.json
      expect(
        superJson.normalized.providers[providerWithParameters].security
      ).toEqual([
        {
          id: 'azure-subscription-key',
          apikey: '$AZURE_COGNITIVE_SERVICES_API_KEY',
        },
      ]);
      expect(
        superJson.normalized.providers[providerWithParameters].parameters
      ).toEqual({
        instance: '$AZURE_COGNITIVE_SERVICES_INSTANCE',
        version: '$AZURE_COGNITIVE_SERVICES_VERSION',
      });
      expect(superJson.document.profiles![profileId]).toEqual({
        version: profileVersion,
        priority: [providerWithParameters],
        providers: { [providerWithParameters]: {} },
      });
    }, 30000);

    it('configures provider with empty security schemes correctly', async () => {
      const emptyProvider = 'empty';
      let result = await execCLI(
        tempDir,
        ['install', 'starwars/character-information'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );

      //mock provider structure
      const mockProviderInfo = {
        name: emptyProvider,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        //empty
        securitySchemes: [],
        defaultService: 'swapidev',
      };
      await mockServer
        .get('/providers/' + emptyProvider)
        .withHeaders({ 'Content-Type': ContentType.JSON })
        .thenJson(200, { definition: mockProviderInfo });

      result = await execCLI(
        tempDir,
        ['configure', emptyProvider, '-p', profileId],
        mockServer.url
      );

      expect(result.stdout).toContain(
        'No security schemes found to configure.'
      );

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();
      expect(superJson.document.providers![emptyProvider]).toEqual({
        security: [],
      });

      expect(superJson.document.profiles![profileId]).toEqual({
        version: profileVersion,
        priority: [emptyProvider],
        providers: { [emptyProvider]: {} },
      });
    }, 30000);

    it('configures provider without security schemes correctly', async () => {
      const providerWithoutSecurity = 'provider-without-security';
      let result = await execCLI(
        tempDir,
        ['install', 'starwars/character-information'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );
      //mock provider structure
      const mockProviderInfo = {
        name: providerWithoutSecurity,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        defaultService: 'swapidev',
      };
      await mockServer
        .get('/providers/' + providerWithoutSecurity)
        .withHeaders({ 'Content-Type': ContentType.JSON })
        .thenJson(200, { definition: mockProviderInfo });

      result = await execCLI(
        tempDir,
        ['configure', providerWithoutSecurity, '-p', profileId],
        mockServer.url
      );

      expect(result.stdout).toContain(
        'No security schemes found to configure.'
      );

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();
      expect(superJson.document.providers![providerWithoutSecurity]).toEqual({
        security: [],
      });

      expect(superJson.document.profiles![profileId]).toEqual({
        version: profileVersion,
        priority: [providerWithoutSecurity],
        providers: { [providerWithoutSecurity]: {} },
      });
    }, 30000);

    it('does not log to stdout with --quiet', async () => {
      let result = await execCLI(
        tempDir,
        ['install', 'starwars/character-information'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );

      result = await execCLI(
        tempDir,
        ['configure', provider, '-p', profileId, '-q'],
        mockServer.url
      );

      expect(result.stdout).toMatch('');

      await expect(
        exists(joinPath(tempDir, 'superface', 'super.json'))
      ).resolves.toBe(true);

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      //Check super.json
      expect(superJson.normalized.providers[provider].security).toEqual([
        {
          id: 'api',
          apikey: `$${provider.toUpperCase()}_API_KEY`,
        },
        {
          id: 'bearer',
          token: `$${provider.toUpperCase()}_TOKEN`,
        },
        {
          id: 'basic',
          username: `$${provider.toUpperCase()}_USERNAME`,
          password: `$${provider.toUpperCase()}_PASSWORD`,
        },
        {
          id: 'digest',
          digest: `$${provider.toUpperCase()}_DIGEST`,
        },
      ]);
      expect(superJson.document.profiles![profileId]).toEqual({
        version: profileVersion,
        priority: [provider],
        providers: { [provider]: {} },
      });
    }, 30000);
  });

  describe('when providers are present in super.json', () => {
    it('errors without a force flag', async () => {
      //set existing super.json
      const localSuperJson = {
        profiles: {
          [profileId]: {
            version: profileVersion,
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {
            security: [
              {
                id: 'apiKey',
                apikey: '$TEST_API_KEY',
              },
            ],
          },
        },
      };
      await mkdirQuiet(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        JSON.stringify(localSuperJson, undefined, 2)
      );

      const result = await execCLI(
        tempDir,
        ['configure', provider, '-p', profileId],
        mockServer.url
      );

      expect(result.stdout).toContain(`Provider already exists: "${provider}"`);

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual(localSuperJson);
    }, 30000);

    it('overrides existing super.json with a force flag', async () => {
      const simpleProvider = 'simple-provider';
      //set existing super.json
      const localSuperJson = {
        profiles: {
          [profileId]: {
            version: profileVersion,
            providers: {
              [simpleProvider]: {},
            },
          },
        },
        providers: {
          [simpleProvider]: {
            security: [
              {
                id: 'apiKey',
                apikey: '$SIMPLE_PROVIDER_API_KEY',
              },
            ],
          },
        },
      };
      await mkdirQuiet(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        JSON.stringify(localSuperJson, undefined, 2)
      );
      const mockProviderInfo = {
        name: simpleProvider,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        securitySchemes: [
          {
            id: 'swapidev',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BEARER,
          },
        ],
        defaultService: 'swapidev',
      };

      await mockServer
        .get('/providers/' + simpleProvider)
        .withHeaders({ 'Content-Type': ContentType.JSON })
        .thenJson(200, { definition: mockProviderInfo });

      const result = await execCLI(
        tempDir,
        ['configure', simpleProvider, '-p', profileId, '-f'],
        mockServer.url
      );

      expect(result.stdout).not.toContain(
        `Provider already exists: "${simpleProvider}"`
      );

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.normalized.providers[simpleProvider].security).toEqual([
        {
          id: 'swapidev',
          token: '$SIMPLE_PROVIDER_TOKEN',
        },
      ]);

      expect(superJson.document.profiles![profileId]).toEqual({
        version: profileVersion,
        priority: [simpleProvider],
        providers: { [simpleProvider]: {} },
      });
    }, 30000);
  });

  describe('when there is a localProvider flag', () => {
    it('loads provider data from file', async () => {
      let result = await execCLI(
        tempDir,
        ['install', 'starwars/character-information'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );

      result = await execCLI(
        tempDir,
        [
          'configure',
          `${provider}`,
          '-p',
          profileId,
          '--localProvider',
          `../../../fixtures/providers/${provider}.json`,
        ],
        mockServer.url
      );

      expect(result.stdout).toContain(
        `🆗 All security schemes have been configured successfully.`
      );
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();
      expect(superJson.normalized.providers[provider].file).toEqual(
        expect.stringContaining(`../../../fixtures/providers/${provider}.json`)
      );

      expect(superJson.normalized.providers[provider].security).toEqual([
        {
          id: 'api',
          apikey: '$SWAPI_API_KEY',
        },
        {
          id: 'bearer',
          token: '$SWAPI_TOKEN',
        },
        {
          id: 'basic',
          password: '$SWAPI_PASSWORD',
          username: '$SWAPI_USERNAME',
        },
        {
          id: 'digest',
          digest: '$SWAPI_DIGEST',
        },
      ]);

      expect(superJson.document.profiles![profileId]).toEqual({
        version: profileVersion,
        priority: [provider],
        providers: { [provider]: {} },
      });
    }, 30000);

    it('does not load provider data from nonexistent file', async () => {
      //set existing super.json
      const localSuperJson = {
        profiles: {
          [profileId]: {
            version: profileVersion,
          },
        },
        providers: {},
      };
      await mkdirQuiet(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        JSON.stringify(localSuperJson, undefined, 2)
      );

      await expect(
        execCLI(
          tempDir,
          [
            'configure',
            provider,
            '-p',
            profileId,
            '--localProvider',
            'some/path',
          ],
          mockServer.url
        )
      ).rejects.toEqual(
        expect.stringContaining('Error: Local path: "some/path" does not exist')
      );

      const finalSuperJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(finalSuperJson.document).toEqual(localSuperJson);
    }, 10000);
  });

  describe('when there is a localMap flag', () => {
    it('fetch provider data from store and adds local map to super.json', async () => {
      let result = await execCLI(
        tempDir,
        ['install', 'starwars/character-information'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );

      result = await execCLI(
        tempDir,
        [
          'configure',
          `${provider}`,
          '-p',
          profileId,
          '--localMap',
          `../../../fixtures/valid.suma`,
        ],
        mockServer.url
      );

      expect(result.stdout).toContain(
        `🆗 All security schemes have been configured successfully.`
      );
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.normalized.providers[provider].security).toEqual([
        {
          id: 'api',
          apikey: '$SWAPI_API_KEY',
        },
        {
          id: 'bearer',
          token: '$SWAPI_TOKEN',
        },
        {
          id: 'basic',
          password: '$SWAPI_PASSWORD',
          username: '$SWAPI_USERNAME',
        },
        {
          id: 'digest',
          digest: '$SWAPI_DIGEST',
        },
      ]);
      expect(superJson.document.profiles![profileId]).toEqual({
        version: profileVersion,
        priority: [provider],
        providers: {
          [provider]: {
            file: expect.stringContaining('../../../fixtures/valid.suma'),
          },
        },
      });
    }, 20000);
  });
});
