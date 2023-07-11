import type { IntegrationParameter } from '@superfaceai/ast';
import { prepareProviderParameters } from '@superfaceai/ast';

export function prepareParameters(
  providerName: string,
  parameters: IntegrationParameter[] | undefined
): { parametersString: string; required: string[] } {
  if (!parameters) {
    return { parametersString: '{}', required: [] };
  }

  const required: string[] = [];

  const parametersMap = prepareProviderParameters(providerName, parameters);

  if (Object.keys(parametersMap).length === 0) {
    return { parametersString: '{}', required };
  }
  Object.values(parametersMap).forEach(value => {
    required.push(value);
  });

  const parametersString =
    '{ ' +
    Object.entries(parametersMap)
      .map(
        ([key, value]) =>
          `${key}: process.env.${
            value.startsWith('$') ? value.slice(1) : value
          }`
      )
      .join(', ') +
    ' }';

  return { parametersString, required };
}
