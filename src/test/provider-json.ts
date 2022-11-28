import type { SecurityScheme } from '@superfaceai/ast';
import { ApiKeyPlacement, HttpScheme, SecurityType } from '@superfaceai/ast';

export const mockProviderJson = (options?: {
  name?: string;
  security?: SecurityScheme[];
}) => ({
  name: options?.name ?? 'provider',
  services: [{ id: 'test-service', baseUrl: 'service/base/url' }],
  securitySchemes: options?.security ?? [
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
});
