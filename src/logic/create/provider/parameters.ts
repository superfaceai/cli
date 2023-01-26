import type { IntegrationParameter } from '@superfaceai/ast';
import { prepareProviderParameters } from '@superfaceai/ast';
import inquirer from 'inquirer';

export async function selectIntegrationParameters(provider: string): Promise<{
  parameters: IntegrationParameter[];
  values: Record<string, string>;
}> {
  const parameters: IntegrationParameter[] = [];
  let exit = false;

  while (!exit) {
    const newParameter = await enterParameter();
    if (newParameter !== undefined) {
      parameters.push(newParameter);
    } else {
      exit = true;
    }
  }

  return {
    parameters,
    values: prepareProviderParameters(provider, parameters),
  };
}

async function enterParameter(): Promise<IntegrationParameter | undefined> {
  const { name } = await inquirer.prompt<{ name: string }>({
    name: 'name',
    message: `Add integration parameter (enter name; or leave empty to skip):`,
    type: 'input',
  });

  if (name === undefined || name === '') {
    return undefined;
  }

  const { defaultValue } = await inquirer.prompt<{ defaultValue: string }>({
    name: 'defaultValue',
    message: `Enter default value for "${name}" parameter (optional):`,
    type: 'input',
    default: undefined,
  });

  return {
    name,
    default: defaultValue,
  };
}
