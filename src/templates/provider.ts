import type {
  IntegrationParameter,
  ProviderJson,
  SecurityScheme,
} from '@superfaceai/ast';

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

export function full(
  name: string,
  baseUrl: string,
  securitySchemes: SecurityScheme[],
  parameters: IntegrationParameter[]
): string {
  const struct: ProviderJson = {
    name,
    services: [
      {
        id: 'default',
        baseUrl,
      },
    ],
    defaultService: 'default',
  };

  if (parameters.length > 0) {
    struct.parameters = parameters;
  }

  if (securitySchemes.length > 0) {
    struct.securitySchemes = securitySchemes;
  }

  return stringifyProvider(struct);
}
