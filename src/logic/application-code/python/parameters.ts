import type { IntegrationParameter } from '@superfaceai/ast';
import { prepareProviderParameters } from '@superfaceai/ast';

export function prepareParameters(
  providerName: string,
  parameters: IntegrationParameter[] | undefined
): {
  parametersString: string;
  required: string[];
} {
  if (!parameters || parameters.length === 0) {
    return { parametersString: '{}', required: [] };
  }

  const parametersMap = prepareProviderParameters(providerName, parameters);
  const required: string[] = [];

  if (Object.keys(parametersMap).length === 0) {
    return { parametersString: '{}', required: [] };
  }
  Object.values(parametersMap).forEach(value => {
    required.push(value);
  });

  return {
    parametersString:
      '{ ' +
      Object.entries(parametersMap)
        .map(
          ([key, value]) =>
            `"${key}": os.getenv('${
              value.startsWith('$') ? value.slice(1) : value
            }')`
        )
        .join(', ') +
      ' }',
    required,
  };
}
