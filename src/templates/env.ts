import {
  isApiKeySecurityScheme,
  isBasicAuthSecurityScheme,
  isBearerTokenSecurityScheme,
  isDigestSecurityScheme,
  SecurityScheme,
} from '@superfaceai/ast';

export function envVariable(name: string, value = ''): string {
  return `${name}=${value}\n`;
}

export function prepareEnvVariables(
  schemes: SecurityScheme[],
  provider: string
): (string | undefined)[] {
  const envProviderName = provider.replace('-', '_').toUpperCase();

  const values: (string | undefined)[] = [];
  const pushValue = (value: string | undefined) => {
    if (values.includes(value)) {
      return;
    }

    values.push(value);
  };

  for (const scheme of schemes) {
    if (isApiKeySecurityScheme(scheme)) {
      pushValue(envVariable(`${envProviderName}_API_KEY`));
    } else if (isBasicAuthSecurityScheme(scheme)) {
      pushValue(envVariable(`${envProviderName}_USERNAME`));
      pushValue(envVariable(`${envProviderName}_PASSWORD`));
    } else if (isBearerTokenSecurityScheme(scheme)) {
      pushValue(envVariable(`${envProviderName}_TOKEN`));
    } else if (isDigestSecurityScheme(scheme)) {
      pushValue(envVariable(`${envProviderName}_USERNAME`));
      pushValue(envVariable(`${envProviderName}_PASSWORD`));
    } else {
      pushValue(undefined);
    }
  }

  return values;
}
