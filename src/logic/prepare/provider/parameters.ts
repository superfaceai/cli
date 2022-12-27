import type { IntegrationParameter } from '@superfaceai/ast';
import { prepareProviderParameters } from '@superfaceai/ast';
import inquirer from 'inquirer';

export async function selectIntegrationParameters(provider: string): Promise<{
  parameters: IntegrationParameter[];
  values: Record<string, string>;
}> {
  const parameters: IntegrationParameter[] = [];
  let exit = false;

  const skip: boolean = (
    await inquirer.prompt<{ skip: boolean }>({
      name: 'skip',
      message: 'Do you want to skip setting up integration parameters?:',
      type: 'confirm',
      default: false,
    })
  ).skip;

  if (skip) {
    return {
      parameters: [],
      values: {},
    };
  }

  while (!exit) {
    parameters.push(await enterParameter(provider));

    exit = !(
      await inquirer.prompt<{ continue: boolean }>({
        name: 'continue',
        message: 'Do you want to set up another integration parameter?:',
        type: 'confirm',
        default: false,
      })
    ).continue;
  }

  return {
    parameters,
    values: prepareProviderParameters(provider, parameters),
  };
}

async function enterParameter(provider: string): Promise<IntegrationParameter> {
  const { name } = await inquirer.prompt<{ name: string }>({
    name: 'name',
    message: `Enter "name" of integration parameter for provider ${provider}:`,
    type: 'input',
    default: `${provider}-api-key`,
  });

  const { defaultValue } = await inquirer.prompt<{ defaultValue: string }>({
    name: 'defaultValue',
    message: `Enter optional default value of integration parameter "${name}" for provider ${provider}:`,
    type: 'input',
    default: undefined,
  });

  return {
    name,
    default: defaultValue,
  };
}
