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
    const newParameter = await enterParameter(provider);
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

async function enterParameter(
  provider: string
): Promise<IntegrationParameter | undefined> {
  const { name } = await inquirer.prompt<{ name: string }>({
    name: 'name',
    message: `Enter "name" of integration parameter for provider ${provider}, do not enter anything to end:`,
    type: 'input',
  });

  if (name === undefined) {
    return undefined;
  }

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
