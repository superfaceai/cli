import type { ProviderJson, SecurityScheme } from '@superfaceai/ast';
import {
  ApiKeyPlacement,
  HttpScheme,
  prepareSecurityValues,
  SecurityType,
} from '@superfaceai/ast';

import { MockLogger } from '../common';
import { fetchProviders } from '../common/http';
import { isCompatible } from '.';

jest.mock('../common/http', () => ({
  fetchProviders: jest.fn(),
}));

describe('Configure logic utils', () => {
  let logger: MockLogger;

  beforeEach(() => {
    logger = new MockLogger();
  });

  describe('Prepare security schemes', () => {
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

    it('prepares security values', async () => {
      expect(prepareSecurityValues(providerName, mockSecuritySchemes)).toEqual([
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
          username: '$TEST_PROVIDER_USERNAME',
          password: '$TEST_PROVIDER_PASSWORD',
        },
      ]);
    });

    it('does not prepare unknown security values', async () => {
      const mockSecurityScheme = { id: 'unknown' };
      expect(
        prepareSecurityValues(providerName, [
          mockSecurityScheme as SecurityScheme,
        ])
      ).toEqual([]);
    });
  });

  describe('isCompatible', () => {
    const profileId = 'profile';

    const compatibleProviders: ProviderJson[] = [
      {
        name: 'first',
        services: [
          {
            id: 'default',
            baseUrl: '',
          },
        ],
        securitySchemes: [],
        defaultService: 'default',
      },
      {
        name: 'second',
        services: [
          {
            id: 'default',
            baseUrl: '',
          },
        ],
        securitySchemes: [],
        defaultService: 'default',
      },
    ];

    it('returns true if provider is compatible', async () => {
      jest.mocked(fetchProviders).mockResolvedValue(compatibleProviders);

      await expect(
        isCompatible(profileId, ['first'], { logger })
      ).resolves.toEqual(true);
    });

    it('returns true if providers are compatible', async () => {
      jest.mocked(fetchProviders).mockResolvedValue(compatibleProviders);

      await expect(
        isCompatible(profileId, ['first', 'second'], { logger })
      ).resolves.toEqual(true);
    });

    it('returns falsee if provider is not compatible', async () => {
      jest.mocked(fetchProviders).mockResolvedValue(compatibleProviders);

      await expect(
        isCompatible(profileId, ['some'], { logger })
      ).resolves.toEqual(false);
    });
  });
});
