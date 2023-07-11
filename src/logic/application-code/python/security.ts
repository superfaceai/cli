import type { SecurityScheme } from '@superfaceai/ast';
import { prepareSecurityValues } from '@superfaceai/ast';

export function prepareSecurity(
  providerName: string,
  security: SecurityScheme[] | undefined
): {
  securityString: string;
  required: string[];
} {
  if (!security || security.length === 0) {
    return { securityString: '{}', required: [] };
  }

  const securityValues = prepareSecurityValues(providerName, security);

  const result: string[] = [];
  const required: string[] = [];

  // TODO: selecting single security scheme is not supported yet
  for (const securityValue of securityValues) {
    const { id, ...securityValueWithoutId } = securityValue;

    const valueString: string[] = [];
    Object.entries(securityValueWithoutId).forEach(
      ([key, value]: [string, string]) => {
        required.push(value);

        valueString.push(
          `"${key}": os.getenv('${
            value.startsWith('$') ? value.slice(1) : value
          }')`
        );
      }
    );

    result.push(`"${id}": { ${valueString.join(', ')} }`);
  }

  return { securityString: '{ ' + result.join(', ') + ' }', required };
}
