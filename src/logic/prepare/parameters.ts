import type { IntegrationParameter } from '@superfaceai/ast';
import inquirer from 'inquirer';

export async function selectIntegrationParameters(
  provider: string
): Promise<(IntegrationParameter & { value: string })[]> {
  const parameters: (IntegrationParameter & { value: string })[] = [];
  let exit = false;

  const skip: boolean = (
    await inquirer.prompt({
      name: 'continue',
      message: 'Do you want to skip setting up integration parameters?:',
      type: 'confirm',
      default: false,
    })
  ).continue;

  if (skip) {
    return [];
  }

  while (!exit) {
    parameters.push(await enterParameter(provider));

    exit = (
      await inquirer.prompt({
        name: 'continue',
        message: 'Do you want to exit setting up integration parameters?:',
        type: 'confirm',
        default: false,
      })
    ).continue;
  }

  return parameters;
}

async function enterParameter(
  provider: string
): Promise<IntegrationParameter & { value: string }> {
  const name: string = (
    await inquirer.prompt({
      name: 'name',
      message: `Enter "name" of integration parameter for provider ${provider}:`,
      type: 'input',
      default: `${provider}-api-key`,
    })
  ).name;

  const description: string | undefined = (
    await inquirer.prompt({
      name: 'description',
      message: `Enter optional description of integration parameter "${name}" for provider ${provider}:`,
      type: 'input',
      default: undefined,
    })
  ).description;

  const value: string = (
    await inquirer.prompt({
      name: 'value',
      message: `Enter value of integration parameter "${name}" for provider ${provider}:`,
      type: 'input',
    })
  ).value;

  const defaultValue: string = (
    await inquirer.prompt({
      name: 'default',
      message: `Enter optional default value of integration parameter "${name}" for provider ${provider}:`,
      type: 'input',
      default: undefined,
    })
  ).default;

  return {
    name,
    default: defaultValue,
    description,
    value,
  };
}
