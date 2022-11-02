import type { ProviderJson, SecurityScheme } from '@superfaceai/ast';

function stringifyProvider(input: ProviderJson): string {
  return JSON.stringify(input, null, 2);
}

export function empty(name: string): string {
  const struct = {
    name,
    services: [
      {
        id: 'default',
        baseUrl: 'noop.localhost',
      },
    ],
    defaultService: 'default',
  };

  return stringifyProvider(struct);
}

export function full(name: string, securitySchemes: SecurityScheme[]): string {
  const struct = {
    name,
    services: [
      {
        id: 'default',
        baseUrl: 'noop.localhost',
      },
    ],
    defaultService: 'default',
    securitySchemes,
    parameters: []
  };

  return stringifyProvider(struct);
}
