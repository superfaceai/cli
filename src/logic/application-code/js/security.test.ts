import type {
  ApiKeySecurityScheme,
  BasicAuthSecurityScheme,
  BearerTokenSecurityScheme,
  DigestSecurityScheme,
} from '@superfaceai/ast';
import { ApiKeyPlacement, HttpScheme, SecurityType } from '@superfaceai/ast';

import { prepareSecurity } from './security';

describe('prepareSecurity', () => {
  const headerApiKey: ApiKeySecurityScheme = {
    id: 'apikey-header',
    type: SecurityType.APIKEY,
    in: ApiKeyPlacement.HEADER,
  };

  const queryApiKey: ApiKeySecurityScheme = {
    id: 'apikey-query',
    type: SecurityType.APIKEY,
    in: ApiKeyPlacement.QUERY,
  };

  const bodyApiKey: ApiKeySecurityScheme = {
    id: 'apikey-body',
    type: SecurityType.APIKEY,
    in: ApiKeyPlacement.BODY,
  };

  const bodyApiKeyWithName: ApiKeySecurityScheme = {
    id: 'apikey-body',
    type: SecurityType.APIKEY,
    in: ApiKeyPlacement.BODY,
    name: 'apiKey',
  };

  const bearerHttp: BearerTokenSecurityScheme = {
    id: 'bearer',
    scheme: HttpScheme.BEARER,
    type: SecurityType.HTTP,
  };

  const digestHttp: DigestSecurityScheme = {
    id: 'digest',
    scheme: HttpScheme.DIGEST,
    type: SecurityType.HTTP,
  };

  const basicHttp: BasicAuthSecurityScheme = {
    id: 'basic',
    scheme: HttpScheme.BASIC,
    type: SecurityType.HTTP,
  };

  it('returns empty object if security schemes are undefined', () => {
    expect(prepareSecurity('test', undefined)).toEqual({
      required: [],
      securityString: '{}',
    });
  });

  it('returns empty object if no security schemes are provided', () => {
    expect(prepareSecurity('test', [])).toEqual({
      required: [],
      securityString: '{}',
    });
  });

  it('correctly prepares security string for api key security', () => {
    expect(
      prepareSecurity('test', [headerApiKey, queryApiKey, bodyApiKey])
    ).toEqual({
      required: ['$TEST_API_KEY', '$TEST_API_KEY', '$TEST_API_KEY'],
      securityString:
        "{ 'apikey-header': { apikey: process.env.TEST_API_KEY }, 'apikey-query': { apikey: process.env.TEST_API_KEY }, 'apikey-body': { apikey: process.env.TEST_API_KEY } }",
    });
  });

  it('correctly prepares security string for api key security with name', () => {
    expect(prepareSecurity('test', [bodyApiKeyWithName])).toEqual({
      required: ['$TEST_API_KEY'],
      securityString: "{ 'apikey-body': { apikey: process.env.TEST_API_KEY } }",
    });
  });

  it('correctly prepares security string for bearer security', () => {
    expect(prepareSecurity('test', [bearerHttp])).toEqual({
      required: ['$TEST_TOKEN'],
      securityString: '{ bearer: { token: process.env.TEST_TOKEN } }',
    });
  });

  it('correctly prepares security string for basic security', () => {
    expect(prepareSecurity('test', [basicHttp])).toEqual({
      required: ['$TEST_USERNAME', '$TEST_PASSWORD'],
      securityString:
        '{ basic: { username: process.env.TEST_USERNAME, password: process.env.TEST_PASSWORD } }',
    });
  });

  it('correctly prepares security string for digest security', () => {
    expect(prepareSecurity('test', [digestHttp])).toEqual({
      required: ['$TEST_USERNAME', '$TEST_PASSWORD'],
      securityString:
        '{ digest: { username: process.env.TEST_USERNAME, password: process.env.TEST_PASSWORD } }',
    });
  });
});
