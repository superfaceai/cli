import { CLIError } from '@oclif/errors';
import {
  ApiKeyPlacement,
  HttpScheme,
  ProviderJson,
  SecurityType,
} from '@superfaceai/one-sdk';
import { ServiceApiError, ServiceClient } from '@superfaceai/service-client';

import {
  ContentType,
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
  fetchProviderInfo,
  fetchProviders,
  getStoreUrl,
  // getStoreUrl,
} from '../common/http';
import { mockResponse } from '../test/utils';

describe('HTTP functions', () => {
  const profileId = 'starwars/character-information';

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe('when getting store url', () => {
    const originalValue = process.env.SUPERFACE_API_URL;

    afterAll(() => {
      if (originalValue) {
        process.env.SUPERFACE_API_URL = originalValue;
      }
    });
    it('returns url from env with backslash', async () => {
      process.env.SUPERFACE_API_URL = 'https://test/url.ai/';
      expect(getStoreUrl()).toEqual('https://test/url.ai');
    });
    it('returns url from env without backslash', async () => {
      process.env.SUPERFACE_API_URL = 'https://test/url.ai';
      expect(getStoreUrl()).toEqual('https://test/url.ai');
    });

    it('returns default url', async () => {
      delete process.env.SUPERFACE_API_URL;
      expect(getStoreUrl()).toEqual('https://superface.ai');
    });
  });
  describe('when fetching providers', () => {
    const mockProviderJson: ProviderJson = {
      name: 'swapi',
      services: [{ id: 'swapi', baseUrl: 'https://swapi.dev/api' }],
      securitySchemes: [
        {
          id: 'api',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.HEADER,
          name: 'X-API-Key',
        },
        {
          type: SecurityType.HTTP,
          scheme: HttpScheme.BEARER,
          id: 'bearer',
        },
        {
          type: SecurityType.HTTP,
          id: 'basic',
          scheme: HttpScheme.BASIC,
        },
        {
          id: 'digest',
          type: SecurityType.HTTP,
          scheme: HttpScheme.DIGEST,
        },
      ],
      defaultService: 'test',
    };

    it('calls superface client correctly', async () => {
      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValue(
          mockResponse(200, 'OK', undefined, { data: [mockProviderJson] })
        );

      await expect(fetchProviders(profileId)).resolves.toEqual([
        mockProviderJson,
      ]);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        `/providers?profile=${encodeURIComponent(profileId)}`,
        {
          authenticate: false,
          method: 'GET',
          headers: {
            'Content-Type': ContentType.JSON,
            'User-Agent': expect.any(String),
          },
        }
      );
    }, 10000);

    it('throws error when request fails', async () => {
      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValue(
          mockResponse(404, 'Not Found', undefined, { detail: 'Not Found' })
        );

      await expect(fetchProviders(profileId)).rejects.toEqual(
        new CLIError('Not Found')
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        `/providers?profile=${encodeURIComponent(profileId)}`,
        {
          authenticate: false,
          method: 'GET',
          headers: {
            'Content-Type': ContentType.JSON,
            'User-Agent': expect.any(String),
          },
        }
      );
    }, 10000);
  });

  describe('when fetching profile info', () => {
    it('calls superface client correctly', async () => {
      //mock profile info
      const mockProfileInfo = {
        profile_id: 'starwars/character-information@1.0.1',
        profile_name: 'starwars/character-information',
        profile_version: '1.0.1',
        url: 'https://superface.dev/starwars/character-information@1.0.1',
        owner: 'freaz',
        owner_url: '',
        published_at: '2021-01-29T08:10:50.925Z',
        published_by: 'Ondrej Musil <mail@ondrejmusil.cz>',
      };

      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValue(mockResponse(200, 'OK', undefined, mockProfileInfo));

      await expect(fetchProfileInfo(profileId)).resolves.toEqual(
        mockProfileInfo
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`/${profileId}`, {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: ContentType.JSON,
          'User-Agent': expect.any(String),
        },
      });
    }, 10000);

    it('throws error when request fails', async () => {
      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValue(
          mockResponse(404, 'Not Found', undefined, { detail: 'Not Found' })
        );

      await expect(fetchProfileInfo(profileId)).rejects.toEqual(
        new CLIError('Not Found')
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`/${profileId}`, {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: ContentType.JSON,
          'User-Agent': expect.any(String),
        },
      });
    }, 10000);
  });

  describe('when fetching profile', () => {
    it('calls superface client correctly', async () => {
      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValue(mockResponse(200, 'OK', undefined, 'mock profile'));

      await expect(fetchProfile(profileId)).resolves.toEqual(`"mock profile"`);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`/${profileId}`, {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: ContentType.PROFILE,
          'User-Agent': expect.any(String),
        },
      });
    }, 10000);

    it('throws error when request fails', async () => {
      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValue(
          mockResponse(404, 'Not Found', undefined, { detail: 'Not Found' })
        );

      await expect(fetchProfile(profileId)).rejects.toEqual(
        new CLIError('Not Found')
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`/${profileId}`, {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: ContentType.PROFILE,
          'User-Agent': expect.any(String),
        },
      });
    }, 10000);
  });

  describe('when fetching profile ast', () => {
    it('calls superface client correctly', async () => {
      //mock profile ast
      const mockProfileAst = {
        kind: 'ProfileDocument',
        header: {
          kind: 'ProfileHeader',
          scope: 'starwars',
          name: 'character-information',
          version: { major: 1, minor: 0, patch: 1 },
          location: { line: 1, column: 1 },
          span: { start: 0, end: 57 },
        },
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'RetrieveCharacterInformation',
            safety: 'safe',
            input: [],
            result: [],
            error: [],
            location: [],
            span: [],
            title: 'Starwars',
          },
        ],
        location: { line: 1, column: 1 },
        span: { start: 0, end: 228 },
      };
      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValue(mockResponse(200, 'OK', undefined, mockProfileAst));

      await expect(fetchProfileAST(profileId)).resolves.toEqual(mockProfileAst);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`/${profileId}`, {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: ContentType.AST,
          'User-Agent': expect.any(String),
        },
      });
    }, 10000);

    it('throws error when request fails', async () => {
      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValue(
          mockResponse(404, 'Not Found', undefined, { detail: 'Not Found' })
        );

      await expect(fetchProfileAST(profileId)).rejects.toEqual(
        new CLIError('Not Found')
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`/${profileId}`, {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: ContentType.AST,
          'User-Agent': expect.any(String),
        },
      });
    }, 10000);
  });

  describe('when fetching provider info', () => {
    const mockProviderJson: ProviderJson = {
      name: 'test',
      services: [{ id: 'test-service', baseUrl: 'service/base/url' }],
      securitySchemes: [
        {
          type: SecurityType.HTTP,
          id: 'basic',
          scheme: HttpScheme.BASIC,
        },
        {
          id: 'api',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.HEADER,
          name: 'Authorization',
        },
        {
          id: 'bearer',
          type: SecurityType.HTTP,
          scheme: HttpScheme.BEARER,
          bearerFormat: 'some',
        },
        {
          id: 'digest',
          type: SecurityType.HTTP,
          scheme: HttpScheme.DIGEST,
        },
      ],
      defaultService: 'test-service',
    };
    it('calls superagent correctly', async () => {
      const provider = 'mailchimp';
      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValue(
          mockResponse(200, 'OK', undefined, mockProviderJson)
        );

      await expect(fetchProviderInfo(provider)).resolves.toEqual(
        mockProviderJson
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`/providers/${provider}`, {
        authenticate: false,
        method: 'GET',
        headers: {
          'Content-Type': ContentType.JSON,
        },
      });
    }, 10000);

    it('throws error when request fails', async () => {
      const provider = 'mailchimp';
      const mockErrResponse = {
        detail: 'Not Found',
        title: 'test-title',
        status: 404,
        instance: 'test',
      };
      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValue(
          mockResponse(404, 'Not Found', undefined, mockErrResponse)
        );

      await expect(fetchProviderInfo(provider)).rejects.toEqual(
        new ServiceApiError(mockErrResponse)
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`/providers/${provider}`, {
        authenticate: false,
        method: 'GET',
        headers: {
          'Content-Type': ContentType.JSON,
        },
      });
    }, 10000);
  });
});
