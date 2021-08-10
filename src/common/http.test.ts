import { CLIError } from '@oclif/errors';
import {
  ApiKeyPlacement,
  HttpScheme,
  ProviderJson,
  SecurityType,
} from '@superfaceai/one-sdk';
import { ServiceApiError, ServiceClient } from '@superfaceai/service-client';
import superagent from 'superagent';

import {
  ContentType,
  fetch,
  fetchProfile,
  fetchProfileAST,
  fetchProfileInfo,
  fetchProfiles,
  fetchProviderInfo,
  fetchProviders,
  fetchVerificationUrl,
  getStoreUrl,
  initLogin,
} from '../common/http';
import { mockResponse } from '../test/utils';
import { userError } from './error';

//Mock superagent
const mockInnerSet = jest.fn();
const mockSet = jest.fn().mockReturnValue({ set: mockInnerSet });
const mockQuery = jest.fn().mockReturnValue({ set: mockSet });

jest.mock('superagent');

describe('HTTP functions', () => {
  const profileId = 'starwars/character-information';

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe('when fetching data', () => {
    it('calls superagent correctly', async () => {
      mockInnerSet.mockResolvedValue({ body: 'test' });
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        set: mockSet,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(fetch(mockUrl, ContentType.JSON)).resolves.toEqual({
        body: 'test',
      });

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.JSON);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);

    it('calls superagent with query params correctly', async () => {
      mockInnerSet.mockResolvedValue({ body: 'test' });
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      mockQuery.mockImplementation(() => ({ set: mockSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        query: mockQuery,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(
        fetch(mockUrl, ContentType.JSON, { test: 'value' })
      ).resolves.toEqual({
        body: 'test',
      });
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith({ test: 'value' });
      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.JSON);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);

    it('catches error during superagent call', async () => {
      mockInnerSet.mockRejectedValue(new Error('Not found'));
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      mockQuery.mockImplementation(() => ({ set: mockSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        query: mockQuery,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(
        fetch(mockUrl, ContentType.JSON, { test: 'value' })
      ).rejects.toThrow(userError('Not found', 1));

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith({ test: 'value' });
      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.JSON);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);

    it('catches error during superagent call with query params', async () => {
      mockInnerSet.mockRejectedValue(new Error('Not found'));
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        set: mockSet,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(fetch(mockUrl, ContentType.JSON)).rejects.toEqual(
        new CLIError('Not found')
      );

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.JSON);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);
  });

  describe('when fetching profiles', () => {
    it('calls superagent correctly', async () => {
      //mock profiles info
      await expect(fetchProfiles()).resolves.toEqual([
        { scope: 'communication', profile: 'send-email', version: '1.0.1' },
      ]);
    }, 10000);
  });

  describe('when fetching providers', () => {
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
      mockInnerSet.mockResolvedValue({ body: { data: [mockProviderJson] } });
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      mockQuery.mockImplementation(() => ({ set: mockSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        query: mockQuery,
      });
      const mockUrl = new URL('providers', getStoreUrl()).href;

      await expect(fetchProviders(profileId)).resolves.toEqual([
        mockProviderJson,
      ]);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith({ profile: profileId });
      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.JSON);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);
  });

  describe('when fetching profile info', () => {
    it('calls superagent correctly', async () => {
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
      mockInnerSet.mockResolvedValue({ body: mockProfileInfo });
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        set: mockSet,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(fetchProfileInfo(profileId)).resolves.toEqual(
        mockProfileInfo
      );

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.JSON);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);
  });

  describe('when fetching profile', () => {
    it('calls superagent correctly', async () => {
      const mockProfile = 'mock profile';

      mockInnerSet.mockResolvedValue({ body: mockProfile });
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        set: mockSet,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(fetchProfile(profileId)).resolves.toEqual(mockProfile);

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.PROFILE);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);
  });

  describe('when fetching profile ast', () => {
    it('calls superagent correctly', async () => {
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
      mockInnerSet.mockResolvedValue({ body: mockProfileAst });
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        set: mockSet,
      });

      const mockUrl = new URL(profileId, getStoreUrl()).href;

      await expect(fetchProfileAST(profileId)).resolves.toEqual(mockProfileAst);

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.AST);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
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
      mockInnerSet.mockResolvedValue({ body: mockProviderJson });
      mockSet.mockImplementation(() => ({ set: mockInnerSet }));
      (jest.spyOn(superagent, 'get') as jest.Mock).mockReturnValue({
        set: mockSet,
      });
      const mockUrl = new URL('mailchimp', `${getStoreUrl()}providers/`).href;

      await expect(fetchProviderInfo('mailchimp')).resolves.toEqual(
        mockProviderJson
      );
      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith('Accept', ContentType.JSON);
      expect(mockInnerSet).toHaveBeenCalledTimes(1);
      expect(mockInnerSet).toHaveBeenCalledWith(
        'User-Agent',
        expect.any(String)
      );
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(superagent, 'get')).toHaveBeenCalledWith(mockUrl);
    }, 10000);
  });

  describe('when initializing login', () => {
    const mockInitResponse = {
      verify_url: 'https://superface.ai/auth/cli/verify?token=stub',
      browser_url: 'https://superface.ai/auth/cli/browser?code=stub',
      expires_at: '2022-01-01T00:00:00.000Z',
    };

    it('calls superface client correctly', async () => {
      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValue(
          mockResponse(200, 'OK', undefined, mockInitResponse)
        );

      await expect(initLogin()).resolves.toEqual(mockInitResponse);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`/auth/cli`, {
        method: 'POST',
        headers: {
          'Content-Type': ContentType.JSON,
        },
      });
    }, 10000);

    it('throws error when request fails', async () => {
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

      await expect(initLogin()).rejects.toEqual(
        new ServiceApiError(mockErrResponse)
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`/auth/cli`, {
        method: 'POST',
        headers: {
          'Content-Type': ContentType.JSON,
        },
      });
    }, 10000);
  });

  describe('when fetching login verification url', () => {
    const mockVerifyResponse = {
      access_token: 'stub',
      refresh_token: 'stub',
      expires_at: '2022-01-01T00:00:00.000Z',
    };
    const mockUrl = 'https://superface.ai/auth/cli/verify?token=stub';

    it('calls superface client correctly, success of the first try', async () => {
      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValueOnce(
          mockResponse(200, 'OK', undefined, mockVerifyResponse)
        );

      await expect(fetchVerificationUrl(mockUrl)).resolves.toEqual(
        mockVerifyResponse
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(mockUrl, {
        method: 'GET',
        headers: {
          'Content-Type': ContentType.JSON,
        },
      });
    }, 10000);

    it('calls superface client correctly, success of the second try', async () => {
      const mockErrResponse = {
        detail: 'Service Unavailable',
        title: 'test-title',
        status: 503,
        instance: 'test',
      };

      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValueOnce(
          mockResponse(503, 'Service Unavailable', undefined, mockErrResponse)
        )
        .mockResolvedValueOnce(
          mockResponse(200, 'OK', undefined, mockVerifyResponse)
        );

      await expect(fetchVerificationUrl(mockUrl)).resolves.toEqual(
        mockVerifyResponse
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy).toHaveBeenCalledWith(mockUrl, {
        method: 'GET',
        headers: {
          'Content-Type': ContentType.JSON,
        },
      });
    }, 10000);

    it('calls superface client correctly, success of the third try', async () => {
      const mockErrResponse = {
        detail: 'Service Unavailable',
        title: 'test-title',
        status: 503,
        instance: 'test',
      };

      const fetchSpy = jest
        .spyOn(ServiceClient.prototype, 'fetch')
        .mockResolvedValueOnce(
          mockResponse(503, 'Service Unavailable', undefined, mockErrResponse)
        )
        .mockResolvedValueOnce(
          mockResponse(503, 'Service Unavailable', undefined, mockErrResponse)
        )
        .mockResolvedValueOnce(
          mockResponse(200, 'OK', undefined, mockVerifyResponse)
        );

      await expect(fetchVerificationUrl(mockUrl)).resolves.toEqual(
        mockVerifyResponse
      );

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy).toHaveBeenCalledWith(mockUrl, {
        method: 'GET',
        headers: {
          'Content-Type': ContentType.JSON,
        },
      });
    }, 10000);

    it('throws error when request fails', async () => {
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

      await expect(fetchVerificationUrl(mockUrl)).rejects.toEqual(
        new ServiceApiError(mockErrResponse)
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(mockUrl, {
        method: 'GET',
        headers: {
          'Content-Type': ContentType.JSON,
        },
      });
    }, 10000);
  });
});
