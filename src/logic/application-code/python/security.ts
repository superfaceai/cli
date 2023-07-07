import type { SecurityScheme } from '@superfaceai/ast';
import { prepareSecurityValues } from '@superfaceai/ast';

import type { ILogger } from '../../../common';

export function prepareSecurityString(
  providerName: string,
  security: SecurityScheme[] | undefined,
  { logger }: { logger: ILogger }
): string {
  if (!security || security.length === 0) {
    return '{}';
  }

  const securityValues = prepareSecurityValues(providerName, security);

  const result: string[] = [];

  // TODO: selecting single security scheme is not supported yet
  for (const securityValue of securityValues) {
    const { id, ...securityValueWithoutId } = securityValue;

    const valueString: string[] = [];
    Object.entries(securityValueWithoutId).forEach(
      ([key, value]: [string, string]) => {
        logger.info('requiredSecurityValue', value);

        valueString.push(
          `"${key}": os.getenv('${
            value.startsWith('$') ? value.slice(1) : value
          }')`
        );
      }
    );

    result.push(`"${id}": { ${valueString.join(', ')} }`);
  }

  return '{ ' + result.join(', ') + ' }';
}
