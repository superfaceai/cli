import type {
  ApiKeyPlacement,
  ApiKeySecurityScheme,
  SecurityScheme,
  SecurityValues,
} from '@superfaceai/ast';
import {
  HttpScheme,
  prepareSecurityValues,
  SecurityType,
} from '@superfaceai/ast';
import inquirer from 'inquirer';

export enum SecuritySchemeName {
  API_KEY = 'API key',
  BEARER_TOKEN = 'Bearer Token',
  BASIC_AUTH = 'Basic Authentication',
  DIGEST = 'Digest Authentication',
  NONE = 'None',
}

export async function selectSecurity(
  provider: string,
  baseUrl: string
): Promise<{ value?: SecurityValues; scheme?: SecurityScheme }> {
  const scheme = await enterSecuritySchema(baseUrl);

  if (scheme === 'none') {
    return {};
  }

  return {
    value: prepareSecurityValues(provider, [scheme])[0],
    scheme,
  };
}

async function enterSecuritySchema(
  baseUrl: string
): Promise<SecurityScheme | 'none'> {
  const schema: SecuritySchemeName = (
    await inquirer.prompt<{
      schema: SecuritySchemeName;
    }>({
      name: 'schema',
      message: `Select authentication method for ${baseUrl}:`,
      type: 'list',
      choices: [
        'API Key',
        'Bearer Token',
        'Basic Authentication',
        'Digest Authentication',
        'none',
      ],
    })
  ).schema;

  console.log('from user', schema);
  if (schema === SecuritySchemeName.API_KEY) {
    return enterApiKeySecurity();
  } else if (schema === SecuritySchemeName.BEARER_TOKEN) {
    return {
      id: 'bearer',
      type: SecurityType.HTTP,
      scheme: HttpScheme.BEARER,
    };
  } else if (schema === SecuritySchemeName.BASIC_AUTH) {
    return {
      id: 'basic',
      type: SecurityType.HTTP,
      scheme: HttpScheme.BASIC,
    };
  } else if (schema === SecuritySchemeName.DIGEST) {
    return {
      id: 'digest',
      type: SecurityType.HTTP,
      scheme: HttpScheme.DIGEST,
    };
  }

  return 'none';
}

async function enterApiKeySecurity(): Promise<ApiKeySecurityScheme> {
  const placement: ApiKeyPlacement = (
    await inquirer.prompt<{ value: ApiKeyPlacement }>({
      name: 'value',
      message: `Where is the API key passed:`,
      type: 'list',
      choices: ['header', 'body', 'path', 'query'],
    })
  ).value;

  const name = (
    await inquirer.prompt<{ name: string | undefined }>({
      name: 'name',
      message: `What is the name of ${placement} param for the API key:`,
      type: 'input',
      default: undefined,
    })
  ).name;

  return {
    id: 'apiKey',
    in: placement,
    type: SecurityType.APIKEY,
    name,
  };
}
