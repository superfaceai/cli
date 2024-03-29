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

  const required: string[] = [];
  const result: string[] = [];

  // TODO: selecting single security scheme is not supported yet
  for (const securityValue of securityValues) {
    const { id, ...securityValueWithoutId } = securityValue;

    let escapedId = id;
    // Escape id
    if (id.includes('-')) {
      escapedId = `'${id}'`;
    }

    const valueString: string[] = [];
    Object.entries(securityValueWithoutId).forEach(
      ([key, value]: [string, string]) => {
        required.push(value);

        valueString.push(
          `${key}: process.env.${
            value.startsWith('$') ? value.slice(1) : value
          }`
        );
      }
    );

    result.push(`${escapedId}: { ${valueString.join(', ')} }`);
  }

  return { securityString: '{ ' + result.join(', ') + ' }', required };
}
