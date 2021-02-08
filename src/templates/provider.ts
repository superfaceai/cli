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

// TODO: This is the new format
// export function pubsProvider(name: string): ProviderStructure {
//   return {
//     name,
//     services: [
//       {
//         id: 'default',
//         baseUrl: 'https://overpass-api.de'
//       }
//     ],
//     defaultService: "default"
//   }
// }

/**
 * Returns default JSON that represents {name}.provider.json file.
 */
export function defaultProvider(name: string): string {
  return JSON.stringify(composeProvider(name), null, 2);
}
