import { ProviderJson } from '@superfaceai/sdk';

import { TemplateType } from './common';

export function provider(type: TemplateType, name: string): string {
  switch (type) {
    case 'empty':
      return empty(name);
    case 'pubs':
      return pubs(name);
  }
}

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

export function pubs(name: string): string {
  const struct = {
    name,
    services: [
      {
        id: 'default',
        baseUrl: 'https://overpass-api.de',
      },
    ],
    defaultService: 'default',
  };

  return stringifyProvider(struct);
}
