/**
 * Returns default JSON that represents {name}.provider.json file.
 */
export function defaultProvider(name: string): string {
  return JSON.stringify(
    {
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
    },
    null,
    2
  );
}
