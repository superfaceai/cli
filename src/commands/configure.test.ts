import { SuperJson } from '@superfaceai/sdk';
import { join as joinPath } from 'path';
import { stderr, stdout } from 'stdout-stderr';

import { SUPER_PATH } from '../common/document';
import { userError } from '../common/error';
import { fetchProviderInfo } from '../common/http';
import { rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import {
  ApiKeySecurityIn,
  AuthSecurityType,
  BearerTokenSecurityScheme,
} from '../common/provider.enums';
import Configure from './configure';

//Mock sdk response
jest.mock('../common/http');

describe('Configure CLI command', () => {
  const WORKING_DIR = joinPath('fixtures', 'configure', 'playground');

  const PROVIDER_NAME = 'test';

  const FIXTURE = {
    superJson: SUPER_PATH,
    scope: PROVIDER_NAME,
  };

  let INITIAL_CWD: string;
  let INITIAL_SUPER_JSON: SuperJson;

  beforeAll(async () => {
    INITIAL_CWD = process.cwd();
    process.chdir(WORKING_DIR);

    INITIAL_SUPER_JSON = (await SuperJson.load(FIXTURE.superJson)).unwrap();
    await rimraf(FIXTURE.scope);
  });

  afterAll(async () => {
    await resetSuperJson();
    await rimraf(FIXTURE.scope);

    // change cwd back
    process.chdir(INITIAL_CWD);
  });

  /** Resets super.json to initial state stored in `INITIAL_SUPER_JSON` */
  async function resetSuperJson() {
    await OutputStream.writeOnce(
      FIXTURE.superJson,
      INITIAL_SUPER_JSON.stringified
    );
  }

  beforeEach(async () => {
    await resetSuperJson();
    await rimraf(FIXTURE.scope);

    stderr.start();
    stdout.start();
  });

  afterEach(() => {
    stderr.stop();
    stdout.stop();
  });

  describe('when configuring new provider', () => {
    it('configures provider with security schemes correctly', async () => {
      //mock provider structure
      (fetchProviderInfo as jest.Mock).mockResolvedValue({
        name: PROVIDER_NAME,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        securitySchemes: [
          {
            id: 'swapidev',
            type: AuthSecurityType.API_KEY,
            in: ApiKeySecurityIn.HEADER,
            name: 'X-API-Key',
          },
          // FIX: SuperJson.load loading only first property of auth
        ],
        defaultService: 'swapidev',
      });

      await expect(Configure.run([PROVIDER_NAME])).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        '🆗 All security schemes have been configured successfully.'
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
      expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
        auth: {
          ApiKey: {
            in: 'header',
            name: 'X-API-Key',
            value: '$TEST_API_KEY',
          },
          // FIX: SuperJson.load loading only first property of auth
        },
      });
    }, 10000);

    it('configures provider with empty security schemes correctly', async () => {
      //mock provider structure
      (fetchProviderInfo as jest.Mock).mockResolvedValue({
        name: PROVIDER_NAME,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        //empty
        securitySchemes: [],
        defaultService: 'swapidev',
      });

      await expect(Configure.run([PROVIDER_NAME])).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        'No security schemes found to configure.'
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
      expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
        auth: {},
      });
    }, 10000);

    it('configures provider without security schemes correctly', async () => {
      //mock provider structure
      (fetchProviderInfo as jest.Mock).mockResolvedValue({
        name: PROVIDER_NAME,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        defaultService: 'swapidev',
      });

      await expect(Configure.run([PROVIDER_NAME])).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        'No security schemes found to configure.'
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
      expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
        auth: {},
      });
    }, 10000);

    it('configures provider with unknown security scheme correctly', async () => {
      //mock provider structure
      (fetchProviderInfo as jest.Mock).mockResolvedValue({
        name: PROVIDER_NAME,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        securitySchemes: [
          {
            id: 'swapidev',
            //unknown
            type: 'unknown',
            in: ApiKeySecurityIn.HEADER,
            name: 'X-API-Key',
          },
        ],
        defaultService: 'swapidev',
      });

      await expect(Configure.run([PROVIDER_NAME])).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        '❌ No security schemes have been configured.'
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
      expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
        auth: {},
      });
    }, 10000);

    it('does not log to stdout with --quiet', async () => {
      //mock provider structure
      (fetchProviderInfo as jest.Mock).mockResolvedValue({
        name: PROVIDER_NAME,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        securitySchemes: [
          {
            id: 'swapidev',
            type: AuthSecurityType.API_KEY,
            in: ApiKeySecurityIn.HEADER,
            name: 'X-API-Key',
          },
          // FIX: SuperJson.load loading only first property of auth
        ],
        defaultService: 'swapidev',
      });

      await expect(
        Configure.run([PROVIDER_NAME, '-q'])
      ).resolves.toBeUndefined();
      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
      expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
        auth: {
          ApiKey: {
            in: 'header',
            name: 'X-API-Key',
            value: '$TEST_API_KEY',
          },
          // FIX: SuperJson.load loading only first property of auth
        },
      });

      expect(stdout.output).toBe('');
    });
  });

  describe('when providers are present in super.json', () => {
    it('errors without a force flag', async () => {
      //set existing super.json
      const localSuperJson = {
        profiles: {},
        providers: {
          [PROVIDER_NAME]: {
            auth: {
              ApiKey: {
                in: 'header',
                name: 'X-API-Key',
                value: '$TEST_API_KEY',
              },
            },
          },
        },
      };
      await OutputStream.writeOnce(
        FIXTURE.superJson,
        JSON.stringify(localSuperJson, undefined, 2)
      );
      //mock provider structure with same provider name but different auth scheme
      (fetchProviderInfo as jest.Mock).mockResolvedValue({
        name: PROVIDER_NAME,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        securitySchemes: [
          {
            id: 'swapidev',
            type: AuthSecurityType.HTTP,
            scheme: BearerTokenSecurityScheme.BEARER,
          },
        ],
        defaultService: 'swapidev',
      });

      await expect(Configure.run([PROVIDER_NAME])).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        `Provider already exists: "${PROVIDER_NAME}"`
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

      expect(superJson.document.providers).toEqual(localSuperJson.providers);
    }, 10000);

    it('overrides existing super.json with a force flag', async () => {
      //set existing super.json
      const localSuperJson = {
        profiles: {},
        providers: {
          [PROVIDER_NAME]: {
            auth: {
              ApiKey: {
                in: 'header',
                name: 'X-API-Key',
                value: '$TEST_API_KEY',
              },
            },
          },
        },
      };
      await OutputStream.writeOnce(
        FIXTURE.superJson,
        JSON.stringify(localSuperJson, undefined, 2)
      );
      //mock provider structure with same provider name but different auth scheme
      (fetchProviderInfo as jest.Mock).mockResolvedValue({
        name: PROVIDER_NAME,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        securitySchemes: [
          {
            id: 'swapidev',
            type: AuthSecurityType.HTTP,
            scheme: BearerTokenSecurityScheme.BEARER,
          },
        ],
        defaultService: 'swapidev',
      });
      //force flag
      await expect(
        Configure.run([PROVIDER_NAME, '-F'])
      ).resolves.toBeUndefined();

      expect(stdout.output).not.toContain(
        `Provider already exists: "${PROVIDER_NAME}"`
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

      expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
        auth: {
          Bearer: {
            name: 'Authorization',
            value: '$TEST_TOKEN',
          },
        },
      });
    }, 10000);
  });

  describe('when there is a file flag', () => {
    it('loads provider data from file', async () => {
      //file flag
      await expect(
        Configure.run(['./superface/swapidev.provider.json', '-f'])
      ).resolves.toBeUndefined();

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

      expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
        auth: {
          ApiKey: {
            in: 'header',
            name: 'X-API-Key',
            value: '$TEST_API_KEY',
          },
        },
      });
    }, 10000);

    it('does not load provider data from corupted file', async () => {
      //file flag
      await expect(
        Configure.run(['./superface/swapidev.provider.corupted.json', '-f'])
      ).rejects.toEqual(
        userError('Unexpected string in JSON at position 168', 1)
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

      expect(superJson.document).toEqual(INITIAL_SUPER_JSON.document);
    }, 10000);

    it('does not load provider data from nonexistent file', async () => {
      //file flag
      await expect(
        Configure.run([
          './very/nice/path/superface/swapidev.provider.json',
          '-f',
        ])
      ).rejects.toEqual(
        userError(
          `Error: ENOENT: no such file or directory, open './very/nice/path/superface/swapidev.provider.json'`,
          1
        )
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

      expect(superJson.document).toEqual(INITIAL_SUPER_JSON.document);
    }, 10000);
  });
});
