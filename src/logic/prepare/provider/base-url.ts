import inquirer from 'inquirer';

import type { UserError } from '../../../common/error';

export async function selecetBaseUrl(
  provider: string,
  { userError }: { userError: UserError }
): Promise<string> {
  // TODO: resolve parameters in url
  const passedUrl = (
    await inquirer.prompt<{ baseUrl: string }>({
      name: 'baseUrl',
      message: `Enter default base url for provider ${provider}. More urls can be added later:`,
      type: 'input',
      default: undefined,
    })
  ).baseUrl.trim();

  try {
    return new URL(passedUrl).href;
  } catch (error) {
    throw userError(`Invalid URL "${passedUrl}": ${String(error)}`, 1);
  }
}
