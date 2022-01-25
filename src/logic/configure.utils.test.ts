import {
  ApiKeyPlacement,
  HttpScheme,
  SecurityScheme,
  SecurityType,
} from '@superfaceai/ast';

import { MockLogger } from '../common';
import { prepareSecurityValues } from '.';

describe('Configure CLI logic', () => {
  let logger: MockLogger;
  const providerName = 'test-provider';
  const mockSecuritySchemes: SecurityScheme[] = [
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
  ];

  beforeEach(() => {
    logger = new MockLogger();
  });

  it('prepares security values', async () => {
    expect(
      prepareSecurityValues(providerName, mockSecuritySchemes, { logger })
    ).toEqual([
      {
        id: 'api',
        apikey: '$TEST_PROVIDER_API_KEY',
      },
      {
        id: 'bearer',
        token: '$TEST_PROVIDER_TOKEN',
      },
      {
        id: 'basic',
        username: '$TEST_PROVIDER_USERNAME',
        password: '$TEST_PROVIDER_PASSWORD',
      },
      {
        id: 'digest',
        digest: '$TEST_PROVIDER_DIGEST',
      },
    ]);
  });

  it('does not prepare unknown security values', async () => {
    const mockSecurityScheme = { id: 'unknown' };
    expect(
      prepareSecurityValues(
        providerName,
        [mockSecurityScheme as SecurityScheme],
        { logger }
      )
    ).toEqual([]);
  });
});
