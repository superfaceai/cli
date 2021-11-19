import { CLIError } from '@oclif/errors';
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

import { Logger } from '../common';
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

//Mock http
jest.mock('../common/http', () => ({
  fetchProviderInfo: jest.fn(),
}));

jest.mock('../common/io');

jest.mock('@superfaceai/one-sdk/dist/internal/superjson');

describe('Configure CLI logic', () => {
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
    Logger.mockLogger();
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
        updateEnv(providerName, mockProviderJson.securitySchemes!)
      ).resolves.toBeUndefined();
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        `TEST_API_KEY=something\nTEST_TOKEN=\nTEST_USERNAME=\nTEST_PASSWORD=\nTEST_DIGEST=\n`
      );
    });

    it('creates new env file correctly', async () => {
      mocked(readFileQuiet).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        updateEnv(providerName, mockProviderJson.securitySchemes!)
      ).resolves.toBeUndefined();
      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        `TEST_API_KEY=\nTEST_TOKEN=\nTEST_USERNAME=\nTEST_PASSWORD=\nTEST_DIGEST=\n`
      );
    });

    it('does not update env file on unknown scheme', async () => {
      mocked(readFileQuiet).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        updateEnv(providerName, [
          {
            id: 'api',
            type: SecurityType.APIKEY,
            name: 'X-API-Key',
          },
        ] as SecurityScheme[])
      ).resolves.toBeUndefined();

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith('.env', '');
    });
  });
  describe('when handling provider response', () => {
    const mockSuperJson = new SuperJson();
    const mockProfileId = ProfileId.fromId('test-profile');
    it('add providers to super json', async () => {
      const setProviderSpy = jest.spyOn(SuperJson.prototype, 'setProvider');
      const setProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'setProfileProvider'
      );

      expect(
        handleProviderResponse(mockSuperJson, mockProfileId, mockProviderJson)
      ).toEqual(4);

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
          { digest: '$TEST_DIGEST', id: 'digest' },
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
        handleProviderResponse(mockSuperJson, mockProfileId, customProviderJson)
      ).toEqual(4);

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
          { digest: '$PROVIDER_TEST_DIGEST', id: 'digest' },
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
        handleProviderResponse(mockSuperJson, mockProfileId, customProviderJson)
      ).toEqual(4);

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
          { digest: '$PROVIDER_TEST_DIGEST', id: 'digest' },
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
          mockSuperJson,
          mockProfileId,
          mockProviderJsonWithSingleSchema
        )
      ).toEqual(0);

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

      await expect(getProviderFromStore(providerName)).resolves.toEqual(
        mockProviderJson
      );
    });

    it('throws on error', async () => {
      mocked(fetchProviderInfo).mockRejectedValue(new Error('test'));

      await expect(getProviderFromStore(providerName)).rejects.toEqual(
        new CLIError('test')
      );
    });
  });

  describe('when instaling provider', () => {
    const mockProfileId = ProfileId.fromId('test-profile');
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
        installProvider({
          superPath: 'some/path',
          provider: providerName,
          profileId: mockProfileId,
          defaults: {
            testUseCase: { retryPolicy: OnFail.CIRCUIT_BREAKER },
          },
        })
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
          { digest: '$TEST_DIGEST', id: 'digest' },
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
        installProvider({
          superPath: 'some/path',
          provider: providerName,
          profileId: mockProfileId,
          defaults: {
            testUseCase: { retryPolicy: OnFail.CIRCUIT_BREAKER },
          },
          options: { updateEnv: true },
        })
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
          { digest: '$TEST_DIGEST', id: 'digest' },
        ],
      });

      expect(writeOnceSpy).toHaveBeenCalledTimes(2);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        `TEST_API_KEY=\nTEST_TOKEN=\nTEST_USERNAME=\nTEST_PASSWORD=\nTEST_DIGEST=\n`
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
        installProvider({
          superPath: 'some/path',
          provider: providerName,
          profileId: mockProfileId,
          defaults: undefined,
          options: {
            localMap: 'maps/send-sms.twilio.suma',
          },
        })
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
          { digest: '$TEST_DIGEST', id: 'digest' },
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
        installProvider({
          superPath: 'some/path',
          provider: providerName,
          profileId: mockProfileId,
          defaults: undefined,
          options: {
            localProvider: 'providers/twilio.provider.json',
          },
        })
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
          { digest: '$TEST_DIGEST', id: 'digest' },
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
        installProvider({
          superPath: 'some/path',
          provider: providerName,
          profileId: mockProfileId,
          defaults: undefined,
          options: {
            localMap: 'maps/send-sms.twilio.suma',
            updateEnv: true,
          },
        })
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
          { digest: '$TEST_DIGEST', id: 'digest' },
        ],
      });

      expect(writeOnceSpy).toHaveBeenCalledTimes(2);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '.env',
        `TEST_API_KEY=\nTEST_TOKEN=\nTEST_USERNAME=\nTEST_PASSWORD=\nTEST_DIGEST=\n`
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
        installProvider({
          superPath: 'some/path',
          provider: providerName,
          profileId: mockProfileId,
          defaults: undefined,
          options: {
            localProvider: 'some/error/path',
          },
        })
      ).rejects.toEqual(new CLIError('test'));

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
        installProvider({
          superPath: 'some/path',
          provider: providerName,
          profileId: mockProfileId,
        })
      ).rejects.toEqual(
        new CLIError(
          `❌ profile ${mockProfileId.id} not found in "some/path/super.json".`
        )
      );

      expect(fetchProviderInfo).not.toHaveBeenCalled();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');
    });

    it('does not write anything if provider already exists', async () => {
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
        installProvider({
          superPath: 'some/path',
          provider: providerName,
          profileId: mockProfileId,
        })
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(setProfileProviderSpy).not.toHaveBeenCalled();
      expect(setProviderSpy).not.toHaveBeenCalled();
      expect(writeOnceSpy).not.toHaveBeenCalled();
    });
  });
});
