import {
  ApiKeyPlacement,
  HttpScheme,
  ok,
  SecurityType,
  SuperJson,
} from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { userError } from '../common/error';
import { fetchProviderInfo } from '../common/http';
import { readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { detectSuperJson } from '../logic/install';
import { MockStd, mockStd } from '../test/mock-std';
import Configure from './configure';

//Mock only fetchProviderInfo response
jest.mock('../common/http', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/http'),
  fetchProviderInfo: jest.fn(),
}));

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

jest.mock('../common/io');

describe('Configure CLI command', () => {
  const originalLoad = SuperJson.load;
  const PROFILE = {
    scope: 'starwars',
    name: 'character-information',
    version: '1.0.1',
  };
  const PROVIDER_NAME = 'test';

  const profileId = `${PROFILE.scope}/${PROFILE.name}`;

  let stdout: MockStd;

  beforeEach(async () => {
    stdout = mockStd();
    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    SuperJson.load = originalLoad;
  });

  describe('when configuring new provider', () => {
    it('configures provider with security schemes correctly', async () => {
      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {},
          },
        },
        providers: {},
      });

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

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

      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`])
      ).resolves.toBeUndefined();

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        JSON.stringify(
          {
            profiles: {
              [profileId]: {
                version: PROFILE.version,
                providers: { [PROVIDER_NAME]: {} },
              },
            },
            providers: {
              [PROVIDER_NAME]: {
                security: [
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
                ],
              },
            },
          },
          undefined,
          2
        ),
        {
          force: false,
          local: false,
          logCb: expect.anything(),
          warnCb: expect.anything(),
        }
      );

      expect(stdout.output).toContain(
        '🆗 All security schemes have been configured successfully.'
      );
    }, 10000);

    it('configures provider with empty security schemes correctly', async () => {
      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {},
          },
        },
        providers: {},
      });

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

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

      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`])
      ).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        'No security schemes found to configure.'
      );
      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        JSON.stringify(
          {
            profiles: {
              [profileId]: {
                version: PROFILE.version,
                providers: { [PROVIDER_NAME]: {} },
              },
            },
            providers: {
              [PROVIDER_NAME]: {
                security: [],
              },
            },
          },
          undefined,
          2
        ),
        {
          force: false,
          local: false,
          logCb: expect.anything(),
          warnCb: expect.anything(),
        }
      );
    }, 10000);

    it('configures provider without security schemes correctly', async () => {
      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {},
          },
        },
        providers: {},
      });

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

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

      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`])
      ).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        'No security schemes found to configure.'
      );
      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        JSON.stringify(
          {
            profiles: {
              [profileId]: {
                version: PROFILE.version,
                providers: { [PROVIDER_NAME]: {} },
              },
            },
            providers: {
              [PROVIDER_NAME]: {
                security: [],
              },
            },
          },
          undefined,
          2
        ),
        {
          force: false,
          local: false,
          logCb: expect.anything(),
          warnCb: expect.anything(),
        }
      );
    }, 10000);

    it('configures provider with unknown security scheme correctly', async () => {
      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {},
          },
        },
        providers: {},
      });

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);
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

      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`])
      ).resolves.toBeUndefined();

      expect(stdout.output).toContain(
        '❌ No security schemes have been configured.'
      );
      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        JSON.stringify(
          {
            profiles: {
              [profileId]: {
                version: PROFILE.version,
                providers: { [PROVIDER_NAME]: {} },
              },
            },
            providers: {
              [PROVIDER_NAME]: {
                security: [],
              },
            },
          },
          undefined,
          2
        ),
        {
          force: false,
          local: false,
          logCb: expect.anything(),
          warnCb: expect.anything(),
        }
      );
    }, 10000);

    it('does not log to stdout with --quiet', async () => {
      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {},
          },
        },
        providers: {},
      });

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

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

      await expect(
        Configure.run([PROVIDER_NAME, `-p ${profileId}`, '-q'])
      ).resolves.toBeUndefined();

      expect(stdout.output).toEqual('');
      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        JSON.stringify(
          {
            profiles: {
              [profileId]: {
                version: PROFILE.version,
                providers: { [PROVIDER_NAME]: {} },
              },
            },
            providers: {
              [PROVIDER_NAME]: {
                security: [
                  {
                    id: 'swapidev',
                    apikey: `$${PROVIDER_NAME.toUpperCase()}_API_KEY`,
                  },
                ],
              },
            },
          },
          undefined,
          2
        ),
        { force: false, local: false, logCb: undefined, warnCb: undefined }
      );
    });
  });

  describe('when providers are present in super.json', () => {
    it('errors without a force flag', async () => {
      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
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
      });

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

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

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).not.toHaveBeenCalled();
    }, 10000);

    it('overrides existing super.json with a force flag', async () => {
      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
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
      });

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

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
      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        JSON.stringify(
          {
            profiles: {
              [profileId]: {
                version: PROFILE.version,
                providers: { [PROVIDER_NAME]: {} },
              },
            },
            providers: {
              [PROVIDER_NAME]: {
                security: [
                  {
                    id: 'apiKey',
                    apikey: `$${PROVIDER_NAME.toUpperCase()}_API_KEY`,
                  },
                  {
                    id: 'swapidev',
                    token: `$${PROVIDER_NAME.toUpperCase()}_TOKEN`,
                  },
                ],
              },
            },
          },
          undefined,
          2
        ),
        {
          force: true,
          local: false,
          logCb: expect.anything(),
          warnCb: expect.anything(),
        }
      );
    }, 10000);
  });

  describe('when there is a path flag', () => {
    it('loads provider data from file', async () => {
      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {},
          },
        },
        providers: {},
      });

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      const mockProviderJson = {
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
      };
      mocked(readFile).mockResolvedValue(JSON.stringify(mockProviderJson));
      //local flag
      await expect(
        Configure.run([
          './superface/swapidev.provider.json',
          `-p ${profileId}`,
          '-l',
        ])
      ).resolves.toBeUndefined();

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(readFile).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        JSON.stringify(
          {
            profiles: {
              [profileId]: {
                version: PROFILE.version,
                providers: { [PROVIDER_NAME]: {} },
              },
            },
            providers: {
              [PROVIDER_NAME]: {
                security: [
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
                ],
              },
            },
          },
          undefined,
          2
        ),
        {
          force: false,
          local: true,
          logCb: expect.anything(),
          warnCb: expect.anything(),
        }
      );
    }, 10000);

    it('does not load provider data from corupted file', async () => {
      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {},
          },
        },
        providers: {},
      });

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      mocked(readFile).mockResolvedValue('//ERR');

      //local flag
      await expect(
        Configure.run([
          './superface/swapidev.provider.corupted.json',
          `-p ${profileId}`,
          '-l',
        ])
      ).rejects.toEqual(
        userError('Unexpected token / in JSON at position 0', 1)
      );

      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(readFile).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).not.toHaveBeenCalled();
    }, 10000);

    it('does not load provider data from nonexistent file', async () => {
      //Mock path do super.json
      const mockPath = 'some/path/';
      mocked(detectSuperJson).mockResolvedValue(mockPath);

      //Mock super.json
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: PROFILE.version,
            providers: {},
          },
        },
        providers: {},
      });

      //We need to mock static side of SuperJson
      const loadSpy = jest.fn().mockReturnValue(ok(mockSuperJson));
      SuperJson.load = loadSpy;

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      mocked(readFile).mockRejectedValue(
        new Error(
          `ENOENT: no such file or directory, open './very/nice/path/superface/swapidev.provider.json'`
        )
      );

      //local flag
      await expect(
        Configure.run([
          './very/nice/path/superface/swapidev.provider.json',
          `-p ${profileId}`,
          '-l',
        ])
      ).rejects.toEqual(
        userError(
          `ENOENT: no such file or directory, open './very/nice/path/superface/swapidev.provider.json'`,
          1
        )
      );
      expect(detectSuperJson).toHaveBeenCalledTimes(1);

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(readFile).toHaveBeenCalledTimes(1);

      expect(writeOnceSpy).not.toHaveBeenCalled();
    }, 10000);
  });
});
