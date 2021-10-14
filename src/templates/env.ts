import { isApiKeySecurityScheme, isBasicAuthSecurityScheme, isBearerTokenSecurityScheme, isDigestSecurityScheme, SecurityScheme } from "@superfaceai/ast";

export function envVariable(name: string, value = ''): string {
  return `${name}=${value}\n`;
}

export function prepareEnvVariables(
  schemes: SecurityScheme[],
  provider: string
): (string | undefined)[] {
  const envProviderName = provider.replace('-', '_').toUpperCase();

  const values: (string | undefined)[] = [];
  for (const scheme of schemes) {
    if (isApiKeySecurityScheme(scheme)) {
      values.push(envVariable(`${envProviderName}_API_KEY`));
    } else if (isBasicAuthSecurityScheme(scheme)) {
      values.push(envVariable(`${envProviderName}_USERNAME`));
      values.push(envVariable(`${envProviderName}_PASSWORD`));
    } else if (isBearerTokenSecurityScheme(scheme)) {
      values.push(envVariable(`${envProviderName}_TOKEN`));
    } else if (isDigestSecurityScheme(scheme)) {
      values.push(envVariable(`${envProviderName}_DIGEST`));
    } else {
      values.push(undefined);
    }
  }

  return values;
}
