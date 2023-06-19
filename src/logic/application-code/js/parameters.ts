import type { IntegrationParameter } from '@superfaceai/ast';
import { prepareProviderParameters } from '@superfaceai/ast';

import type { ILogger } from '../../../common';

export function prepareParametersString(
  providerName: string,
  parameters: IntegrationParameter[] | undefined,
  { logger }: { logger: ILogger }
): string {
  if (!parameters) {
    return '{}';
  }

  const parametersMap = prepareProviderParameters(providerName, parameters);

  if (Object.keys(parametersMap).length === 0) {
    return '{}';
  }
  Object.values(parametersMap).forEach(value => {
    logger.info('requiredParameterValue', value);
  });

  console.log(parametersMap);

  return (
    '{ ' +
    Object.entries(parametersMap)
      .map(
        ([key, value]) =>
          `${key}: process.env.${
            value.startsWith('$') ? value.slice(1) : value
          }`
      )
      .join(', ') +
    ' }'
  );
}
