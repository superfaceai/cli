import type { IntegrationParameter, SecurityScheme } from '@superfaceai/ast';
import {
  prepareProviderParameters,
  prepareSecurityValues,
} from '@superfaceai/ast';

import {
  ONESDK_TOKEN_COMMENT,
  ONESDK_TOKEN_ENV,
  ONESDK_TOKEN_UNAVAILABLE_COMMENT,
} from './onesdk-token';

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
  previousDotenv,
  providerName,
  parameters,
  security,
  token,
}: {
  previousDotenv?: string;
  providerName: string;
  parameters?: IntegrationParameter[];
  security?: SecurityScheme[];
  token?: string | null;
}): NewDotenv {
  const previousContent = previousDotenv ?? '';

  const parameterEnvs = getParameterEnvs(providerName, parameters);
  const securityEnvs = getSecurityEnvs(providerName, security);
  const tokenEnv = makeTokenEnv(token);

  const allEnvVariables = [tokenEnv, ...parameterEnvs, ...securityEnvs];

  const newEnvsOnly = makeFilterForNewEnvs(previousContent);

  const newEnvVariables = allEnvVariables.filter(newEnvsOnly);

  return {
    content: serializeContent(previousContent, newEnvVariables),
    addedEnvVariables: newEnvVariables.map(e => e.name),
  };
}

function makeTokenEnv(token?: string | null): EnvVar {
  return {
    name: ONESDK_TOKEN_ENV,
    value: token ?? undefined,
    comment:
      token !== undefined && token !== null
        ? ONESDK_TOKEN_COMMENT
        : ONESDK_TOKEN_UNAVAILABLE_COMMENT,
  };
}

function makeFilterForNewEnvs(content: string): (e: EnvVar) => boolean {
  const existingEnvs = new Set(
    content
      .split('\n')
      .map(line => line.match(/^(\w+)=/)?.[1])
      .filter((s: string | undefined): s is string => Boolean(s))
      .map(t => t.toLowerCase())
  );

  // returns true for envs that are NOT present in the `content`
  return env => {
    return !existingEnvs.has(env.name.toLowerCase());
  };
}

function serializeContent(previousContent: string, newEnvs: EnvVar[]): string {
  const newEnvContent = newEnvs.map(serializeEnvVar).join('\n').trim();

  const newContent = [previousContent, newEnvContent]
    .filter(Boolean)
    .join('\n');

  return newEnvContent ? newContent + '\n' : newContent;
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
