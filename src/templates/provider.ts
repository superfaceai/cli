import { ProviderStructure } from '../common/provider.interfaces';

export function composeProvider(name: string): ProviderStructure {
  return {
    name,
    deployments: [
      {
        id: 'default',
        baseUrl: `api.${name}.localhost`,
      },
    ],
    security: [
      {
        auth: {
          BasicAuth: {
            type: 'http',
            scheme: 'basic',
          },
        },
        hosts: ['default'],
      },
    ],
  };
}

/**
 * Returns default JSON that represents {name}.provider.json file.
 */
export function defaultProvider(name: string): string {
  return JSON.stringify(composeProvider(name), null, 2);
}
