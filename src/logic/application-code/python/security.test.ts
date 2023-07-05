import type {
  ApiKeySecurityScheme,
  BasicAuthSecurityScheme,
  BearerTokenSecurityScheme,
  DigestSecurityScheme,
} from '@superfaceai/ast';
import { ApiKeyPlacement, HttpScheme, SecurityType } from '@superfaceai/ast';

import { MockLogger } from '../../../common';
import { prepareSecurityString } from './security';

describe('prepareSecurityString', () => {
  const logger = new MockLogger();

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
    expect(prepareSecurityString('test', undefined, { logger })).toEqual('{}');
  });

  it('returns empty object if no security schemes are provided', () => {
    expect(prepareSecurityString('test', [], { logger })).toEqual('{}');
  });

  it('correctly prepares security string for api key security', () => {
    expect(
      prepareSecurityString('test', [headerApiKey, queryApiKey, bodyApiKey], {
        logger,
      })
    ).toEqual(
      `{ "apikey-header": { "apikey": os.getenv('TEST_API_KEY') }, "apikey-query": { "apikey": os.getenv('TEST_API_KEY') }, "apikey-body": { "apikey": os.getenv('TEST_API_KEY') } }`
    );
  });

  it('correctly prepares security string for api key security with name', () => {
    expect(
      prepareSecurityString('test', [bodyApiKeyWithName], { logger })
    ).toEqual(`{ "apikey-body": { "apikey": os.getenv('TEST_API_KEY') } }`);
  });

  it('correctly prepares security string for bearer security', () => {
    expect(prepareSecurityString('test', [bearerHttp], { logger })).toEqual(
      `{ "bearer": { "token": os.getenv('TEST_TOKEN') } }`
    );
  });

  it('correctly prepares security string for basic security', () => {
    expect(prepareSecurityString('test', [basicHttp], { logger })).toEqual(
      `{ "basic": { "username": os.getenv('TEST_USERNAME'), "password": os.getenv('TEST_PASSWORD') } }`
    );
  });

  it('correctly prepares security string for digest security', () => {
    expect(prepareSecurityString('test', [digestHttp], { logger })).toEqual(
      `{ "digest": { "username": os.getenv('TEST_USERNAME'), "password": os.getenv('TEST_PASSWORD') } }`
    );
  });
});
