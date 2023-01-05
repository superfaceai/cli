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

export async function selectSecurity(
  provider: string
): Promise<{ value?: SecurityValues; scheme?: SecurityScheme }> {
  const scheme = await enterSecuritySchema(provider);

  if (scheme === 'none') {
    return {};
  }

  return {
    value: prepareSecurityValues(provider, [scheme])[0],
    scheme,
  };
}

async function enterSecuritySchema(
  provider: string
): Promise<SecurityScheme | 'none'> {
  const schema: 'api key token' | 'bearer token' | 'basic' | 'digest' | 'none' =
    (
      await inquirer.prompt<{
        schema: 'api key token' | 'bearer token' | 'basic' | 'digest' | 'none';
      }>({
        name: 'schema',
        message: `Select authentication method for ${baseUrl}:`,
        type: 'list',
        choices: ['API Key', 'Bearer Token', 'Basic Auth', 'Digest', 'none'],
      })
    ).schema;

  if (schema === 'api key token') {
    return enterApiKeySecurity(provider);
  } else if (schema === 'bearer token') {
    return {
      id: 'bearer',
      type: SecurityType.HTTP,
      scheme: HttpScheme.BEARER,
    };
  } else if (schema === 'basic') {
    return {
      id: schema,
      type: SecurityType.HTTP,
      scheme: HttpScheme.BASIC,
    };
  } else if (schema === 'digest') {
    return {
      id: schema,
      type: SecurityType.HTTP,
      scheme: HttpScheme.DIGEST,
    };
  }

  return 'none';
}

async function enterApiKeySecurity(
  provider: string
): Promise<ApiKeySecurityScheme> {
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
