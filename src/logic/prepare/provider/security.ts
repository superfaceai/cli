import type {
  ApiKeyPlacement,
  ApiKeySecurityScheme,
  BasicAuthSecurityScheme,
  BearerTokenSecurityScheme,
  DigestSecurityScheme,
  SecurityScheme,
  SecurityValues,
} from '@superfaceai/ast';
import {
  HttpScheme,
  prepareSecurityValues,
  SecurityType,
} from '@superfaceai/ast';
import inquirer from 'inquirer';

export async function selectSecuritySchemas(
  provider: string
): Promise<{ values: SecurityValues[]; schemes: SecurityScheme[] }> {
  const result = await enterSecuritySchema(provider);

  if (result === 'none') {
    return { schemes: [], values: [] };
  }

  return {
    values: prepareSecurityValues(provider, [result.schema]),
    schemes: [result.schema],
  };
}

async function enterSecuritySchema(
  provider: string
): Promise<{ schema: SecurityScheme } | 'none'> {
  const schemaResponse: {
    schema: 'api key token' | 'bearer token' | 'basic' | 'digest' | 'none';
  } = await inquirer.prompt({
    name: 'schema',
    message: `Select a security schema for ${provider}:`,
    type: 'list',
    choices: ['api key token', 'bearer token', 'basic', 'digest', 'none'],
  });

  if (schemaResponse.schema === 'api key token') {
    return enterApiKeySecurity(provider);
  } else if (schemaResponse.schema === 'bearer token') {
    return enterBearerSecurity();
  } else if (schemaResponse.schema === 'basic') {
    return enterHttpSecurity(HttpScheme.BASIC);
  } else if (schemaResponse.schema === 'digest') {
    return enterHttpSecurity(HttpScheme.DIGEST);
  }

  return 'none';
}

async function enterHttpSecurity(
  scheme: HttpScheme.BASIC | HttpScheme.DIGEST
): Promise<{
  schema: BasicAuthSecurityScheme | DigestSecurityScheme;
}> {
  return {
    schema: {
      id: scheme,
      type: SecurityType.HTTP,
      scheme,
    },
  };
}

async function enterBearerSecurity(): Promise<{
  schema: BearerTokenSecurityScheme;
}> {
  return {
    schema: {
      id: 'bearer',
      type: SecurityType.HTTP,
      scheme: HttpScheme.BEARER,
    },
  };
}

async function enterApiKeySecurity(
  provider: string
): Promise<{ schema: ApiKeySecurityScheme }> {
  const placement: ApiKeyPlacement = (
    await inquirer.prompt<{ value: ApiKeyPlacement }>({
      name: 'value',
      message: `Enter placement of API key for provider ${provider}:`,
      type: 'list',
      choices: ['header', 'body', 'path', 'query'],
    })
  ).value;

  const name = (
    await inquirer.prompt<{ name: string | undefined }>({
      name: 'name',
      message: `Enter optional name of API key security property for provider ${provider}:`,
      type: 'input',
      default: undefined,
    })
  ).name;

  return {
    schema: {
      id: 'apiKey',
      in: placement,
      type: SecurityType.APIKEY,
      name,
    },
  };
}
