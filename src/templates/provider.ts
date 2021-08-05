import { ProviderJson } from '@superfaceai/one-sdk';

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
