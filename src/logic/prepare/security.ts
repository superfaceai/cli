import { SecurityValues, SecurityScheme, BearerTokenSecurityValues, BearerTokenSecurityScheme, SecurityType, HttpScheme, ApiKeySecurityValues, ApiKeySecurityScheme, ApiKeyPlacement, BasicAuthSecurityValues, BasicAuthSecurityScheme } from "@superfaceai/ast"
import inquirer from "inquirer"

export async function selectSecuritySchemas(
  provider: string,
): Promise<(SecurityValues & SecurityScheme)[]> {
  const securitySchemes: (SecurityValues & SecurityScheme)[] = []
  let exit: boolean = false

  while (!exit) {
    const schema = await enterSecuritySchema(provider)

    if (schema === undefined) {
      exit = true
    } else {
      securitySchemes.push(schema)
    }
  }

  return securitySchemes
}

async function enterSecuritySchema(
  provider: string,
): Promise<(SecurityValues & SecurityScheme) | undefined> {
  const schemaResponse: { schema: 'api key token' | 'bearer token' | 'basic' | 'digest' | 'none' } = await inquirer.prompt({
    name: 'schema',
    message: `Select a security schema for ${provider}:`,
    type: 'list',
    choices: ['api key token', 'bearer token', 'basic', 'digest', 'none']
  });

  console.log('schema', schemaResponse.schema)

  if (schemaResponse.schema === 'api key token') {
    return enterApiKeySecurity(provider)
  } else if (schemaResponse.schema === 'bearer token') {
    return enterBearerSecurity(provider)
  } else if (schemaResponse.schema === 'basic') {
    return enterBasicSecurity(provider)
  }

  return undefined
}

async function enterBasicSecurity(provider: string): Promise<BasicAuthSecurityValues & BasicAuthSecurityScheme> {

  const id: string = (await inquirer.prompt({
    name: 'id',
    message: `Enter "id" of basic auth security for provider ${provider}:`,
    type: 'input',
    default: `${provider}-api-key`
  })).id;

  const username = (await inquirer.prompt<{ username: string }>({
    name: 'username',
    message: `Enter username for provider ${provider}. It can be value or name of environment value (starting with $):`,
    type: 'input',
    default: undefined
  })).username

  const password = (await inquirer.prompt<{ password: string }>({
    name: 'password',
    message: `Enter password of provider ${provider}. It can be value or name of environment value (starting with $):`,
    type: 'input',
    default: undefined
  })).password


  return {
    id,
    username,
    password,
    type: SecurityType.HTTP,
    scheme: HttpScheme.BASIC
  }

}

async function enterBearerSecurity(provider: string): Promise<BearerTokenSecurityValues & BearerTokenSecurityScheme> {

  const id: string = (await inquirer.prompt({
    name: 'id',
    message: `Enter "id" of bearer token security for provider ${provider}:`,
    type: 'input',
    default: `${provider}-api-key`
  })).id;

  const token = (await inquirer.prompt<{ token: string }>({
    name: 'token',
    message: `Enter value of bearer token for provider ${provider}. It can be value or name of environment value (starting with $):`,
    type: 'input',
    default: undefined
  })).token


  return {
    id,
    token,
    type: SecurityType.HTTP,
    scheme: HttpScheme.BEARER,
  }

}

async function enterApiKeySecurity(provider: string): Promise<ApiKeySecurityValues & ApiKeySecurityScheme> {

  const id: string = (await inquirer.prompt({
    name: 'id',
    message: `Enter "id" of API key security for provider ${provider}:`,
    type: 'input',
    default: `${provider}-api-key`
  })).id;

  const placement: ApiKeyPlacement = (await inquirer.prompt({
    name: 'value',
    message: `Enter placement of API key for provider ${provider}:`,
    type: 'list',
    choices: ["header", "body", "path", "query"]
  })).value;

  const name = (await inquirer.prompt<{ name: string | undefined }>({
    name: 'name',
    message: `Enter "name" of API key security for provider ${provider}:`,
    type: 'input',
    default: undefined
  })).name;

  const apikey = (await inquirer.prompt<{ apikey: string }>({
    name: 'apikey',
    message: `Enter value of API key for provider ${provider}. It can be value or name of environment value (starting with $):`,
    type: 'input',
    default: undefined
  })).apikey


  return {
    id,
    apikey,
    in: placement,
    type: SecurityType.APIKEY,
    name
  }
}