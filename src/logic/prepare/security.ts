import type {
  ApiKeyPlacement,
  ApiKeySecurityScheme,
  ApiKeySecurityValues,
  BasicAuthSecurityScheme,
  BasicAuthSecurityValues,
  BearerTokenSecurityScheme,
  BearerTokenSecurityValues,
  DigestSecurityScheme,
  DigestSecurityValues,
  SecurityScheme,
  SecurityValues,
} from '@superfaceai/ast';
import { HttpScheme, SecurityType } from '@superfaceai/ast';
import inquirer from 'inquirer';

export async function selectSecuritySchemas(
  provider: string
): Promise<{ values: SecurityValues[]; schemes: SecurityScheme[] }> {
  const schemes: SecurityScheme[] = [];
  const values: SecurityValues[] = [];

  let exit = false;

  while (!exit) {
    const result = await enterSecuritySchema(provider);

    if (result === undefined) {
      exit = true;
    } else if (result === 'none') {
      // empty
    } else {
      schemes.push(result.schema);
      values.push(result.value);
    }
  }

  return { schemes, values };
}

async function enterSecuritySchema(
  provider: string
): Promise<
  { value: SecurityValues; schema: SecurityScheme } | 'none' | undefined
> {
  const schemaResponse: {
    schema:
      | 'api key token'
      | 'bearer token'
      | 'basic'
      | 'digest'
      | 'none'
      | 'exit';
  } = await inquirer.prompt({
    name: 'schema',
    message: `Select a security schema for ${provider}:`,
    type: 'list',
    choices: [
      'api key token',
      'bearer token',
      'basic',
      'digest',
      'none',
      'exit',
    ],
  });

  console.log('schema', schemaResponse.schema);

  if (schemaResponse.schema === 'api key token') {
    return enterApiKeySecurity(provider);
  } else if (schemaResponse.schema === 'bearer token') {
    return enterBearerSecurity(provider);
  } else if (schemaResponse.schema === 'basic') {
    return enterHttpSecurity(provider, HttpScheme.BASIC);
  } else if (schemaResponse.schema === 'digest') {
    return enterHttpSecurity(provider, HttpScheme.DIGEST);
  } else if (schemaResponse.schema === 'none') {
    return 'none';
  }

  return undefined;
}

async function enterHttpSecurity(
  provider: string,
  scheme: HttpScheme.BASIC | HttpScheme.DIGEST
): Promise<{
  value: BasicAuthSecurityValues | DigestSecurityValues;
  schema: BasicAuthSecurityScheme | DigestSecurityScheme;
}> {
  const id: string = (
    await inquirer.prompt({
      name: 'id',
      message: `Enter "id" of basic auth security for provider ${provider}:`,
      type: 'input',
      default: `${provider}-api-key`,
    })
  ).id;

  const username = (
    await inquirer.prompt<{ username: string }>({
      name: 'username',
      message: `Enter username for provider ${provider}. It can be value or name of environment value (starting with $):`,
      type: 'input',
      default: undefined,
    })
  ).username;

  const password = (
    await inquirer.prompt<{ password: string }>({
      name: 'password',
      message: `Enter password of provider ${provider}. It can be value or name of environment value (starting with $):`,
      type: 'input',
      default: undefined,
    })
  ).password;

  return {
    schema: {
      id,
      type: SecurityType.HTTP,
      scheme,
    },
    value: {
      id,
      username,
      password,
    },
  };
}

async function enterBearerSecurity(provider: string): Promise<{
  value: BearerTokenSecurityValues;
  schema: BearerTokenSecurityScheme;
}> {
  const id: string = (
    await inquirer.prompt({
      name: 'id',
      message: `Enter "id" of bearer token security for provider ${provider}:`,
      type: 'input',
      default: `${provider}-api-key`,
    })
  ).id;

  const token = (
    await inquirer.prompt<{ token: string }>({
      name: 'token',
      message: `Enter value of bearer token for provider ${provider}. It can be value or name of environment value (starting with $):`,
      type: 'input',
      default: undefined,
    })
  ).token;

  return {
    value: {
      id,
      token,
    },
    schema: {
      id,
      type: SecurityType.HTTP,
      scheme: HttpScheme.BEARER,
    },
  };
}

async function enterApiKeySecurity(
  provider: string
): Promise<{ value: ApiKeySecurityValues; schema: ApiKeySecurityScheme }> {
  const id: string = (
    await inquirer.prompt({
      name: 'id',
      message: `Enter "id" of API key security for provider ${provider}:`,
      type: 'input',
      default: `${provider}-api-key`,
    })
  ).id;

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

  const apikey = (
    await inquirer.prompt<{ apikey: string }>({
      name: 'apikey',
      message: `Enter value of API key for provider ${provider}. It can be value or name of environment value (starting with $):`,
      type: 'input',
      default: undefined,
    })
  ).apikey;

  return {
    schema: {
      id,
      in: placement,
      type: SecurityType.APIKEY,
      name,
    },
    value: {
      id,
      apikey,
    },
  };
}
