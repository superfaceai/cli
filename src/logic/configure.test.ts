import {
  ApiKeyPlacement,
  HttpScheme,
  OnFail,
  ProviderJson,
  SecurityScheme,
  SecurityType,
} from '@superfaceai/ast';
import { ok, SuperJson } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { MockLogger } from '../common';
import { createUserError } from '../common/error';
import { fetchProviderInfo } from '../common/http';
import { readFile, readFileQuiet } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import {
  getProviderFromStore,
  handleProviderResponse,
  installProvider,
  updateEnv,
} from './configure';

jest.mock('../common/http', () => ({
  fetchProviderInfo: jest.fn(),
}));
jest.mock('../common/io');
jest.mock('@superfaceai/one-sdk/dist/internal/superjson');

describe('Configure CLI logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);
  const providerName = 'test';
  const mockProviderJson: ProviderJson = {
    name: providerName,
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

  beforeEach(async () => {
    logger = new MockLogger();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when updating env file', () => {
    it('updates env file correctly', async () => {
      mocked(readFileQuiet).mockResolvedValue('TEST_API_KEY=something\n');
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        updateEnv(providerName, mockProviderJson.securitySchemes!, { logger })
      ).resolves.toBeUndefined();
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'TEST_API_KEY=something\nTEST_TOKEN=\nTEST_USERNAME=\nTEST_PASSWORD=\nTEST_DIGEST=\n'
      );
    });

    it('creates new env file correctly', async () => {
      mocked(readFileQuiet).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        updateEnv(providerName, mockProviderJson.securitySchemes!, { logger })
      ).resolves.toBeUndefined();
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'TEST_API_KEY=\nTEST_TOKEN=\nTEST_USERNAME=\nTEST_PASSWORD=\nTEST_DIGEST=\n'
      );
    });

    it('does not update env file on unknown scheme', async () => {
      mocked(readFileQuiet).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        updateEnv(
          providerName,
          [
            {
              id: 'api',
              type: SecurityType.APIKEY,
              name: 'X-API-Key',
            },
          ] as SecurityScheme[],
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith('.env', '');
    });
  });
  describe('when handling provider response', () => {
    let mockSuperJson: SuperJson;
    const mockProfileId = ProfileId.fromId('test-profile', { userError });

    beforeEach(async () => {
      mockSuperJson = new SuperJson();

      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          providers: {},
        },
      });
    });
    it('add providers to super json', async () => {
      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      expect(
        handleProviderResponse(
          {
            superJson: mockSuperJson,
            profileId: mockProfileId,
            response: mockProviderJson,
          },
          { logger }
        )
      ).toEqual({ numberOfConfigured: 4, providerUpdated: true });

      expect(setProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).toHaveBeenCalledWith(providerName, {
        security: [
          { apikey: '$TEST_API_KEY', id: 'api' },
          { id: 'bearer', token: '$TEST_TOKEN' },
          {
            id: 'basic',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
          {
            id: 'digest',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
        ],
      });

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId.id,
        providerName,
        {}
      );
    });

    it('add provider with - in name to super json', async () => {
      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      const customProviderJson: ProviderJson = {
        name: 'provider-test',
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

      expect(
        handleProviderResponse(
          {
            superJson: mockSuperJson,
            profileId: mockProfileId,
            response: customProviderJson,
          },
          { logger }
        )
      ).toEqual({ numberOfConfigured: 4, providerUpdated: true });

      expect(setProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).toHaveBeenCalledWith('provider-test', {
        security: [
          { apikey: '$PROVIDER_TEST_API_KEY', id: 'api' },
          { id: 'bearer', token: '$PROVIDER_TEST_TOKEN' },
          {
            id: 'basic',
            password: '$PROVIDER_TEST_PASSWORD',
            username: '$PROVIDER_TEST_USERNAME',
          },
          {
            id: 'digest',
            password: '$PROVIDER_TEST_PASSWORD',
            username: '$PROVIDER_TEST_USERNAME',
          },
        ],
      });

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId.id,
        'provider-test',
        {}
      );
    });

    it('add provider with parameters to super json', async () => {
      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      const customProviderJson: ProviderJson = {
        name: 'provider-test',
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
        parameters: [
          {
            name: 'first',
            default: 'first-value',
            description: '1',
          },
          {
            name: 'second',
            description: '2',
          },
          {
            name: 'third',
          },
        ],
      };

      expect(
        handleProviderResponse(
          {
            superJson: mockSuperJson,
            profileId: mockProfileId,
            response: customProviderJson,
          },
          { logger }
        )
      ).toEqual({ numberOfConfigured: 4, providerUpdated: true });

      expect(setProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).toHaveBeenCalledWith('provider-test', {
        security: [
          { apikey: '$PROVIDER_TEST_API_KEY', id: 'api' },
          { id: 'bearer', token: '$PROVIDER_TEST_TOKEN' },
          {
            id: 'basic',
            password: '$PROVIDER_TEST_PASSWORD',
            username: '$PROVIDER_TEST_USERNAME',
          },
          {
            id: 'digest',
            password: '$PROVIDER_TEST_PASSWORD',
            username: '$PROVIDER_TEST_USERNAME',
          },
        ],
        parameters: {
          first: '$PROVIDER_TEST_FIRST',
          second: '$PROVIDER_TEST_SECOND',
          third: '$PROVIDER_TEST_THIRD',
        },
      });

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId.id,
        'provider-test',
        {}
      );
    });

    it('does not overwrite existing provider', async () => {
      const mockSecurity = {
        id: 'basic',
        username: 'username',
        password: 'password',
      };
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          providers: {
            [mockProviderJson.name]: {
              security: [mockSecurity],
            },
          },
        },
      });
      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      expect(
        handleProviderResponse(
          {
            superJson: mockSuperJson,
            profileId: mockProfileId,
            response: mockProviderJson,
          },
          { logger }
        )
      ).toEqual({ numberOfConfigured: 0, providerUpdated: false });

      expect(setProviderSpy).not.toHaveBeenCalled();

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId.id,
        providerName,
        {}
      );
    });

    it('overwrites existing provider with force', async () => {
      const mockSecurity = {
        id: 'basic',
        username: 'username',
        password: 'password',
      };
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          providers: {
            [mockProviderJson.name]: {
              security: [mockSecurity],
            },
          },
        },
      });
      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      expect(
        handleProviderResponse(
          {
            superJson: mockSuperJson,
            profileId: mockProfileId,
            response: mockProviderJson,
            options: { force: true },
          },
          { logger }
        )
      ).toEqual({ numberOfConfigured: 4, providerUpdated: true });

      expect(setProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).toHaveBeenCalledWith(providerName, {
        security: [
          { apikey: '$TEST_API_KEY', id: 'api' },
          { id: 'bearer', token: '$TEST_TOKEN' },
          {
            id: 'basic',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
          {
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME', id: 'digest'
          },
        ],
      });

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId.id,
        providerName,
        {}
      );
    });

    it('does not throw error on unknown security scheme', async () => {
      const mockProviderJsonWithSingleSchema: ProviderJson = {
        name: providerName,
        services: [
          {
            id: 'swapidev',
            baseUrl: 'https://swapi.dev/api',
          },
        ],
        securitySchemes: [
          {
            id: 'something',
            type: '' as SecurityType.APIKEY,
            in: ApiKeyPlacement.HEADER,
            name: 'X-API-Key',
          },
        ],
        defaultService: 'swapidev',
      };
      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      expect(
        handleProviderResponse(
          {
            superJson: mockSuperJson,
            profileId: mockProfileId,
            response: mockProviderJsonWithSingleSchema,
          },
          { logger }
        )
      ).toEqual({ numberOfConfigured: 0, providerUpdated: true });

      expect(setProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).toHaveBeenCalledWith(providerName, {
        security: [],
      });

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId.id,
        providerName,
        {}
      );
    });
  });

  describe('when geting provider from store', () => {
    it('returns correct result', async () => {
      mocked(fetchProviderInfo).mockResolvedValue(mockProviderJson);

      await expect(
        getProviderFromStore(providerName, { logger, userError })
      ).resolves.toEqual(mockProviderJson);
    });

    it('throws on error', async () => {
      mocked(fetchProviderInfo).mockRejectedValue(new Error('test'));

      await expect(
        getProviderFromStore(providerName, { logger, userError })
      ).rejects.toThrow('test');
    });
  });

  describe('when instaling provider', () => {
    const mockProfileId = ProfileId.fromId('test-profile', { userError });
    const mockSuperJson = new SuperJson({
      profiles: {
        [mockProfileId.id]: {
          version: '1.0.0',
          defaults: {},
          providers: {},
        },
      },
      providers: {},
    });

    it('install provider correctly', async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            [mockProfileId.id]: {
              version: '1.0.0',
              defaults: {},
              providers: {},
            },
          },
          providers: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      mocked(fetchProviderInfo).mockResolvedValue(mockProviderJson);

      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        installProvider(
          {
            superPath: 'some/path',
            provider: providerName,
            profileId: mockProfileId,
            defaults: {
              testUseCase: { retryPolicy: OnFail.CIRCUIT_BREAKER },
            },
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId.id,
        providerName,
        { defaults: { testUseCase: { retryPolicy: OnFail.CIRCUIT_BREAKER } } }
      );

      expect(setProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).toHaveBeenCalledWith(providerName, {
        security: [
          { apikey: '$TEST_API_KEY', id: 'api' },
          { id: 'bearer', token: '$TEST_TOKEN' },
          {
            id: 'basic',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
          {
            id: 'digest',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
        ],
      });

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('install provider correctly and updates env file', async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            [mockProfileId.id]: {
              version: '1.0.0',
              defaults: {},
              providers: {},
            },
          },
          providers: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(fetchProviderInfo).mockResolvedValue(mockProviderJson);

      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        installProvider(
          {
            superPath: 'some/path',
            provider: providerName,
            profileId: mockProfileId,
            defaults: {
              testUseCase: { retryPolicy: OnFail.CIRCUIT_BREAKER },
            },
            options: { updateEnv: true },
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId.id,
        providerName,
        { defaults: { testUseCase: { retryPolicy: OnFail.CIRCUIT_BREAKER } } }
      );

      expect(setProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).toHaveBeenCalledWith(providerName, {
        security: [
          { apikey: '$TEST_API_KEY', id: 'api' },
          { id: 'bearer', token: '$TEST_TOKEN' },
          {
            id: 'basic',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
          {
            id: 'digest',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
        ],
      });

      expect(writeOnceSpy).toHaveBeenCalledTimes(2);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'TEST_API_KEY=\nTEST_TOKEN=\nTEST_USERNAME=\nTEST_PASSWORD=\nTEST_DIGEST=\n'
      );
    });

    it('installs provider correctly with localMap flag', async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            [mockProfileId.id]: {
              version: '1.0.0',
              defaults: {},
              providers: {},
            },
          },
          providers: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      mocked(fetchProviderInfo).mockResolvedValue(mockProviderJson);

      await expect(
        installProvider(
          {
            superPath: 'some/path',
            provider: providerName,
            profileId: mockProfileId,
            defaults: undefined,
            options: {
              localMap: 'maps/send-sms.twilio.suma',
            },
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId.id,
        providerName,
        {}
      );

      expect(setProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).toHaveBeenCalledWith(providerName, {
        security: [
          { apikey: '$TEST_API_KEY', id: 'api' },
          { id: 'bearer', token: '$TEST_TOKEN' },
          {
            id: 'basic',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
          {
            id: 'digest',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
        ],
      });

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('installs provider correctly with localProvider flag', async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            [mockProfileId.id]: {
              version: '1.0.0',
              defaults: {},
              providers: {},
            },
          },
          providers: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      mocked(readFile).mockResolvedValue(JSON.stringify(mockProviderJson));

      await expect(
        installProvider(
          {
            superPath: 'some/path',
            provider: providerName,
            profileId: mockProfileId,
            defaults: undefined,
            options: {
              localProvider: 'providers/twilio.provider.json',
            },
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).not.toHaveBeenCalled();

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId.id,
        providerName,
        {}
      );

      expect(setProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).toHaveBeenCalledWith(providerName, {
        security: [
          { apikey: '$TEST_API_KEY', id: 'api' },
          { id: 'bearer', token: '$TEST_TOKEN' },
          {
            id: 'basic',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
          {
            id: 'digest',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
        ],
      });

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('installs provider correctly with localMap flag and updates env file', async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            [mockProfileId.id]: {
              version: '1.0.0',
              defaults: {},
              providers: {},
            },
          },
          providers: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      mocked(fetchProviderInfo).mockResolvedValue(mockProviderJson);

      await expect(
        installProvider(
          {
            superPath: 'some/path',
            provider: providerName,
            profileId: mockProfileId,
            defaults: undefined,
            options: {
              localMap: 'maps/send-sms.twilio.suma',
              updateEnv: true,
            },
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId.id,
        providerName,
        {}
      );

      expect(setProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).toHaveBeenCalledWith(providerName, {
        security: [
          { apikey: '$TEST_API_KEY', id: 'api' },
          { id: 'bearer', token: '$TEST_TOKEN' },
          {
            id: 'basic',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
          {
            id: 'digest',
            password: '$TEST_PASSWORD',
            username: '$TEST_USERNAME',
          },
        ],
      });

      expect(writeOnceSpy).toHaveBeenCalledTimes(2);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        'TEST_API_KEY=\nTEST_TOKEN=\nTEST_USERNAME=\nTEST_PASSWORD=\nTEST_DIGEST=\n'
      );
    });

    it('throws error when there is an error during local loading of provider json', async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            [mockProfileId.id]: {
              version: '1.0.0',
              defaults: {},
              providers: {},
            },
          },
          providers: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(readFile).mockRejectedValue(new Error('test'));

      await expect(
        installProvider(
          {
            superPath: 'some/path',
            provider: providerName,
            profileId: mockProfileId,
            defaults: undefined,
            options: {
              localProvider: 'some/error/path',
            },
          },
          { logger, userError }
        )
      ).rejects.toThrow('test');

      expect(fetchProviderInfo).not.toHaveBeenCalled();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');
    });

    it('throws error when profile not found', async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {},
          providers: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        installProvider(
          {
            superPath: 'some/path',
            provider: providerName,
            profileId: mockProfileId,
          },
          { logger, userError }
        )
      ).rejects.toThrow(
        `profile ${mockProfileId.id} not found in "some/path/super.json".`
      );

      expect(fetchProviderInfo).not.toHaveBeenCalled();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');
    });

    it("does not print info about security schemes if provider hasn't been updated", async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            [mockProfileId.id]: {
              version: '1.0.0',
              defaults: {},
              providers: {},
            },
          },
          providers: {
            [providerName]: {},
          },
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      mocked(fetchProviderInfo).mockResolvedValue(mockProviderJson);

      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        installProvider(
          {
            superPath: 'some/path',
            provider: providerName,
            profileId: mockProfileId,
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(logger.stdout).toEqual([
        ['fetchProvider', [providerName]],
        ['configureProviderSecurity', [providerName]],
        ['updateSuperJson', [undefined]],
        ['profileProviderConfigured', [providerName, mockProfileId.toString()]],
        ['noSecurityFoundOrAlreadyConfigured', []],
      ]);

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).not.toHaveBeenCalled();
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('prints info about security schemes if provider has been updated', async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            [mockProfileId.id]: {
              version: '1.0.0',
              defaults: {},
              providers: {},
            },
          },
          providers: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      mocked(fetchProviderInfo).mockResolvedValue(mockProviderJson);

      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        installProvider(
          {
            superPath: 'some/path',
            provider: providerName,
            profileId: mockProfileId,
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(logger.stdout).toEqual([
        ['fetchProvider', [providerName]],
        ['configureProviderSecurity', [providerName]],
        ['updateSuperJson', [undefined]],
        ['profileProviderConfigured', [providerName, mockProfileId.toString()]],
        ['allSecurityConfigured', []],
      ]);

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(setProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(setProviderSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
    });
  });
});
