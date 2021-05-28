import { CLIError } from '@oclif/errors';
import {
  ApiKeyPlacement,
  HttpScheme,
  ok,
  ProviderJson,
  SecurityType,
  SuperJson,
} from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { fetchProviderInfo } from '../common/http';
import { readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import {
  getProviderFromStore,
  handleProviderResponse,
  installProvider,
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
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when handling provider response', () => {
    const mockSuperJson = new SuperJson();
    const mockProfileId = 'testProfile';
    it('add providers to super json', async () => {
      const addProviderSpy = jest.spyOn(SuperJson.prototype, 'addProvider');
      const addProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'addProfileProvider'
      );

      expect(
        handleProviderResponse(mockSuperJson, mockProfileId, mockProviderJson)
      ).toEqual(4);

      expect(addProviderSpy).toHaveBeenCalledTimes(1);
      expect(addProviderSpy).toHaveBeenCalledWith(providerName, {
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

      expect(addProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(addProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId,
        providerName,
        {}
      );
    });

    it('add provider with - in name to super json', async () => {
      const addProviderSpy = jest.spyOn(SuperJson.prototype, 'addProvider');
      const addProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'addProfileProvider'
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

      expect(addProviderSpy).toHaveBeenCalledTimes(1);
      expect(addProviderSpy).toHaveBeenCalledWith('provider-test', {
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

      expect(addProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(addProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId,
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
      const addProviderSpy = jest.spyOn(SuperJson.prototype, 'addProvider');
      const addProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'addProfileProvider'
      );

      expect(
        handleProviderResponse(
          mockSuperJson,
          mockProfileId,
          mockProviderJsonWithSingleSchema
        )
      ).toEqual(0);

      expect(addProviderSpy).toHaveBeenCalledTimes(1);
      expect(addProviderSpy).toHaveBeenCalledWith(providerName, {
        security: [],
      });

      expect(addProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(addProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId,
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
    const mockProfileId = 'testProfile';
    const mockSuperJson = new SuperJson({
      profiles: {
        [mockProfileId]: {
          version: '1.0.0',
          defaults: {},
          providers: {},
        },
      },
      providers: {},
    });

    it('returns correct number of instaled security schemes', async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            [mockProfileId]: {
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

      const addProviderSpy = jest.spyOn(SuperJson.prototype, 'addProvider');
      const addProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'addProfileProvider'
      );

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        installProvider('some/path', providerName, mockProfileId)
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(addProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(addProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId,
        providerName,
        {}
      );

      expect(addProviderSpy).toHaveBeenCalledTimes(1);
      expect(addProviderSpy).toHaveBeenCalledWith(providerName, {
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

    it('returns correct number of instaled security schemes with local flag', async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            [mockProfileId]: {
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

      const addProviderSpy = jest.spyOn(SuperJson.prototype, 'addProvider');
      const addProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'addProfileProvider'
      );

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      mocked(readFile).mockResolvedValue(JSON.stringify(mockProviderJson));

      await expect(
        installProvider('some/path', providerName, mockProfileId, {
          local: true,
        })
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).not.toHaveBeenCalled();

      expect(addProfileProviderSpy).toHaveBeenCalledTimes(1);
      expect(addProfileProviderSpy).toHaveBeenCalledWith(
        mockProfileId,
        providerName,
        {}
      );

      expect(addProviderSpy).toHaveBeenCalledTimes(1);
      expect(addProviderSpy).toHaveBeenCalledWith(providerName, {
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

    it('throws error when there is an error during local loading of provider json', async () => {
      //normalized is getter on SuperJson - unable to mock or spy on
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            [mockProfileId]: {
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
        installProvider('some/path', providerName, mockProfileId, {
          local: true,
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
        installProvider('some/path', providerName, mockProfileId)
      ).rejects.toEqual(
        new CLIError(
          `❌ profile ${mockProfileId} not found in some/path. Forgot to install?`
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
            [mockProfileId]: {
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

      const addProviderSpy = jest.spyOn(SuperJson.prototype, 'addProvider');
      const addProfileProviderSpy = jest.spyOn(
        SuperJson.prototype,
        'addProfileProvider'
      );

      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        installProvider('some/path', providerName, mockProfileId)
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('some/path/super.json');

      expect(fetchProviderInfo).toHaveBeenCalledTimes(1);

      expect(addProfileProviderSpy).not.toHaveBeenCalled();
      expect(addProviderSpy).not.toHaveBeenCalled();
      expect(writeOnceSpy).not.toHaveBeenCalled();
    });
  });
});
