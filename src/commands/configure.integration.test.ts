import {
  ApiKeyPlacement,
  HttpScheme,
  SecurityType,
  SuperJson,
} from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';
import { mocked } from 'ts-jest/utils';

import { EXTENSIONS, GRID_DIR, SUPER_PATH } from '../common/document';
import { userError } from '../common/error';
import { fetchProviderInfo } from '../common/http';
import { rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { MockStd, mockStd } from '../test/mock-std';
import Configure from './configure';

//Mock only fetchProviderInfo response
jest.mock('../common/http', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/http'),
  fetchProviderInfo: jest.fn(),
}));

describe('Configure CLI command', () => {
  const WORKING_DIR = joinPath('fixtures', 'configure', 'playground');

  const PROFILE = {
    scope: 'starwars',
    name: 'character-information',
    version: '1.0.1',
  };
  const PROVIDER_NAME = 'test';

  const FIXTURE = {
    superJson: SUPER_PATH,
    scope: joinPath(GRID_DIR, PROFILE.scope),
    profile: joinPath(
      GRID_DIR,
      PROFILE.scope,
      PROFILE.name + '@' + PROFILE.version + EXTENSIONS.profile.source
    ),
    ast: joinPath(
      GRID_DIR,
      PROFILE.scope,
      PROFILE.name +
        '@' +
        PROFILE.version +
        EXTENSIONS.profile.source +
        '.ast.json'
    ),
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

  afterEach(() => {
    jest.resetAllMocks();
  });

  /** Resets super.json to initial state stored in `INITIAL_SUPER_JSON` */
  async function resetSuperJson() {
    await OutputStream.writeOnce(
      FIXTURE.superJson,
      INITIAL_SUPER_JSON.stringified
    );
  }
  let stdout: MockStd;

  beforeEach(async () => {
    await resetSuperJson();
    await rimraf(FIXTURE.scope);

    stdout = mockStd();
    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when configuring new provider', () => {
    it('configures provider with security schemes correctly', async () => {
      //mock provider structure
      mocked(fetchProviderInfo).mockResolvedValue({
        name: PROVIDER_NAME,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        securitySchemes: [
          {
            id: 'api',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.HEADER,
            name: 'X-API-Key',
          },
          {
            id: 'bearer',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BEARER,
          },
          {
            id: 'basic',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BASIC,
          },
          {
            id: 'digest',
            type: SecurityType.HTTP,
            scheme: HttpScheme.DIGEST,
          },
        ],
        defaultService: 'swapidev',
      });

      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`])
      ).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        '🆗 All security schemes have been configured successfully.'
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
      //Check super.json
      expect(superJson.normalized.providers[PROVIDER_NAME].security).toEqual([
        {
          id: 'api',
          apikey: `$${PROVIDER_NAME.toUpperCase()}_API_KEY`,
        },
        {
          id: 'bearer',
          token: `$${PROVIDER_NAME.toUpperCase()}_TOKEN`,
        },
        {
          id: 'basic',
          username: `$${PROVIDER_NAME.toUpperCase()}_USERNAME`,
          password: `$${PROVIDER_NAME.toUpperCase()}_PASSWORD`,
        },
        {
          id: 'digest',
          digest: `$${PROVIDER_NAME.toUpperCase()}_DIGEST`,
        },
      ]);
      expect(superJson.document.profiles![profileId]).toEqual({
        version: PROFILE.version,
        providers: { [PROVIDER_NAME]: {} },
      });
    }, 10000);

    it('configures provider with empty security schemes correctly', async () => {
      //mock provider structure
      mocked(fetchProviderInfo).mockResolvedValue({
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

      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`])
      ).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        'No security schemes found to configure.'
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
      expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
        security: [],
      });

      expect(superJson.document.profiles![profileId]).toEqual({
        version: PROFILE.version,
        providers: { [PROVIDER_NAME]: {} },
      });
    }, 10000);

    it('configures provider without security schemes correctly', async () => {
      //mock provider structure
      mocked(fetchProviderInfo).mockResolvedValue({
        name: PROVIDER_NAME,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        defaultService: 'swapidev',
      });
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`])
      ).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        'No security schemes found to configure.'
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
      expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
        security: [],
      });

      expect(superJson.document.profiles![profileId]).toEqual({
        version: PROFILE.version,
        providers: { [PROVIDER_NAME]: {} },
      });
    }, 10000);

    it('configures provider with unknown security scheme correctly', async () => {
      //mock provider structure
      mocked(fetchProviderInfo).mockResolvedValue({
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
            type: 'unknown' as SecurityType.APIKEY,
            in: ApiKeyPlacement.HEADER,
            name: 'X-API-Key',
          },
        ],
        defaultService: 'swapidev',
      });
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`])
      ).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        '❌ No security schemes have been configured.'
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
      expect(superJson.document.providers![PROVIDER_NAME]).toEqual({
        security: [],
      });

      expect(superJson.document.profiles![profileId]).toEqual({
        version: PROFILE.version,
        providers: { [PROVIDER_NAME]: {} },
      });
    }, 10000);

    it('does not log to stdout with --quiet', async () => {
      //mock provider structure
      mocked(fetchProviderInfo).mockResolvedValue({
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
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.HEADER,
            name: 'X-API-Key',
          },
        ],
        defaultService: 'swapidev',
      });
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`, '-q'])
      ).resolves.toBeUndefined();
      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();
      expect(
        superJson.normalized.providers[PROVIDER_NAME].security
      ).toContainEqual({
        apikey: '$TEST_API_KEY',
        id: 'swapidev',
      });

      expect(superJson.document.profiles![profileId]).toEqual({
        version: PROFILE.version,
        providers: { [PROVIDER_NAME]: {} },
      });
    });
  });

  describe('when providers are present in super.json', () => {
    it('errors without a force flag', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      //set existing super.json
      const localSuperJson = {
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {
              [PROVIDER_NAME]: {},
            },
          },
        },
        providers: {
          [PROVIDER_NAME]: {
            security: [
              {
                id: 'apiKey',
                apikey: '$TEST_API_KEY',
              },
            ],
          },
        },
      };
      await OutputStream.writeOnce(
        FIXTURE.superJson,
        JSON.stringify(localSuperJson, undefined, 2)
      );
      //mock provider structure with same provider name but different auth scheme
      mocked(fetchProviderInfo).mockResolvedValue({
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
            type: SecurityType.HTTP,
            scheme: HttpScheme.BEARER,
          },
        ],
        defaultService: 'swapidev',
      });

      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`])
      ).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        `Provider already exists: "${PROVIDER_NAME}"`
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

      expect(superJson.document).toEqual(localSuperJson);
    }, 10000);

    it('overrides existing super.json with a force flag', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      //set existing super.json
      const localSuperJson = {
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {
              [PROVIDER_NAME]: {},
            },
          },
        },
        providers: {
          [PROVIDER_NAME]: {
            security: [
              {
                id: 'apiKey',
                apikey: '$TEST_API_KEY',
              },
            ],
          },
        },
      };
      await OutputStream.writeOnce(
        FIXTURE.superJson,
        JSON.stringify(localSuperJson, undefined, 2)
      );
      //mock provider structure with same provider name but different auth scheme
      mocked(fetchProviderInfo).mockResolvedValue({
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
            type: SecurityType.HTTP,
            scheme: HttpScheme.BEARER,
          },
        ],
        defaultService: 'swapidev',
      });

      //force flag
      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`, '-f'])
      ).resolves.toBeUndefined();

      expect(stdout.output).not.toContain(
        `Provider already exists: "${PROVIDER_NAME}"`
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

      expect(superJson.normalized.providers[PROVIDER_NAME].security).toEqual([
        {
          id: 'apiKey',
          apikey: '$TEST_API_KEY',
        },
        {
          id: 'swapidev',
          token: '$TEST_TOKEN',
        },
      ]);

      expect(superJson.document.profiles![profileId]).toEqual({
        version: PROFILE.version,
        providers: { [PROVIDER_NAME]: {} },
      });
    }, 10000);
  });

  describe('when there is a path flag', () => {
    it('loads provider data from file', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      //local flag
      await expect(
        Configure.run([
          './superface/swapidev.provider.json',
          `-p ${profileId}`,
          '-l',
        ])
      ).resolves.toBeUndefined();

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

      expect(superJson.normalized.providers[PROVIDER_NAME].security).toEqual([
        {
          id: 'api',
          apikey: '$TEST_API_KEY',
        },
        {
          id: 'digest',
          digest: '$TEST_DIGEST',
        },
      ]);

      expect(superJson.document.profiles![profileId]).toEqual({
        version: PROFILE.version,
        providers: { [PROVIDER_NAME]: {} },
      });
    }, 10000);

    it('does not load provider data from corupted file', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      //local flag
      await expect(
        Configure.run([
          './superface/swapidev.provider.corupted.json',
          `-p ${profileId}`,
          '-l',
        ])
      ).rejects.toEqual(
        userError('Unexpected string in JSON at position 168', 1)
      );

      const superJson = (await SuperJson.load(FIXTURE.superJson)).unwrap();

      expect(superJson.document).toEqual(INITIAL_SUPER_JSON.document);
    }, 10000);

    it('does not load provider data from nonexistent file', async () => {
      const profileId = `${PROFILE.scope}/${PROFILE.name}`;

      //local flag
      await expect(
        Configure.run([
          './very/nice/path/superface/swapidev.provider.json',
          `-p ${profileId}`,
          '-l',
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
