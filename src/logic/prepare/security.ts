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
  prepareSecurityValues,
  HttpScheme,
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
  // provider: string,
  scheme: HttpScheme.BASIC | HttpScheme.DIGEST
): Promise<{
  // value: BasicAuthSecurityValues | DigestSecurityValues;
  schema: BasicAuthSecurityScheme | DigestSecurityScheme;
}> {
  // const username = (
  //   await inquirer.prompt<{ username: string }>({
  //     name: 'username',
  //     message: `Enter username for provider ${provider}. It can be value or name of environment value (starting with $):`,
  //     type: 'input',
  //     default: undefined,
  //   })
  // ).username;

  // const password = (
  //   await inquirer.prompt<{ password: string }>({
  //     name: 'password',
  //     message: `Enter password of provider ${provider}. It can be value or name of environment value (starting with $):`,
  //     type: 'input',
  //     default: undefined,
  //   })
  // ).password;

  return {
    schema: {
      id: scheme,
      type: SecurityType.HTTP,
      scheme,
    },
    // value: {
    //   id: scheme,
    //   username,
    //   password,
    // },
  };
}

async function enterBearerSecurity(): Promise<{
  // value: BearerTokenSecurityValues;
  schema: BearerTokenSecurityScheme;
}> {
  // const token = (
  //   await inquirer.prompt<{ token: string }>({
  //     name: 'token',
  //     message: `Enter value of bearer token for provider ${provider}. It can be value or name of environment value (starting with $):`,
  //     type: 'input',
  //     default: undefined,
  //   })
  // ).token;

  return {
    // value: {
    //   id: 'bearer',
    //   token,
    // },
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
    await inquirer.prompt({
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

  // const apikey = (
  //   await inquirer.prompt<{ apikey: string }>({
  //     name: 'apikey',
  //     message: `Enter value of API key for provider ${provider}. It can be value or name of environment value (starting with $):`,
  //     type: 'input',
  //     default: undefined,
  //   })
  // ).apikey;

  return {
    schema: {
      id: 'apiKey',
      in: placement,
      type: SecurityType.APIKEY,
      name,
    },
    // value: {
    //   id: 'apiKey',
    //   apikey,
    // },
  };
}
