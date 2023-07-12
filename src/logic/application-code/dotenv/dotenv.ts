import type { IntegrationParameter, SecurityScheme } from '@superfaceai/ast';
import {
  prepareProviderParameters,
  prepareSecurityValues,
} from '@superfaceai/ast';

export type NewDotenv = {
  content: string;
  addedEnvVariables: string[];
};

type EnvVar = {
  name: string;
  value: string | undefined;
  comment: string | undefined;
};

export function createNewDotenv({
  providerName,
  parameters,
  security,
}: {
  providerName: string;
  parameters?: IntegrationParameter[];
  security?: SecurityScheme[];
}): NewDotenv {
  const parameterEnvs = getParameterEnvs(providerName, parameters);
  const securityEnvs = getSecurityEnvs(providerName, security);

  const newEnvVariables = [...parameterEnvs, ...securityEnvs];

  if (newEnvVariables.length === 0) {
    return {
      content: '',
      addedEnvVariables: [],
    };
  }

  const newContent =
    newEnvVariables.map(serializeEnvVar).join('\n').trim() + '\n';

  return {
    content: newContent,
    addedEnvVariables: newEnvVariables.map(e => e.name),
  };
}

function serializeEnvVar(env: EnvVar): string {
  const comment =
    env.comment !== undefined
      ? '\n' +
        env.comment
          .split('\n')
          .map(commentLine => `# ${commentLine}`)
          .join('\n')
      : '';

  return `${comment ? comment + '\n' : ''}${env.name}=${env.value ?? ''}`;
}

function getParameterEnvs(
  providerName: string,
  parameters?: IntegrationParameter[]
): EnvVar[] {
  const params = parameters || [];

  const parameterEnvs = prepareProviderParameters(providerName, params);

  return params.map(param => ({
    name: removeDollarSign(parameterEnvs[param.name]),
    value: param.default ?? undefined,
    comment: param.description ?? undefined,
  }));
}

function getSecurityEnvs(
  providerName: string,
  security?: SecurityScheme[]
): EnvVar[] {
  const securityValues = prepareSecurityValues(providerName, security || []);

  return securityValues
    .map(({ id: _, ...securityValue }) => securityValue)
    .flatMap(securityValue => Object.values(securityValue) as string[])
    .map(removeDollarSign)
    .map(name => ({ name, value: undefined, comment: undefined }));
}

const removeDollarSign = (text: string): string =>
  text.startsWith('$') ? text.slice(1) : text;
