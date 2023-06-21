import inquirer from "inquirer";
import { ILogger } from "../../common";
import { UserError } from "../../common/error";
import { IPackageManager } from "../../common/package-manager";


export async function setupJsProject({
  logger,
  pm,
  userError,
}: { logger: ILogger; pm: IPackageManager; userError: UserError }) {

  // Check/init package-manager
  if (!(await pm.packageJsonExists())) {
    logger.warn('packageJsonNotFound');
    // Prompt user for package manager initialization
    const response: {
      pm: 'yarn' | 'npm' | 'exit';
    } = await inquirer.prompt({
      name: 'pm',
      message:
        'Do you want to initialize package manager ("yes" flag will be used)?',
      type: 'list',
      choices: [
        { name: 'Yarn (yarn must be installed)', value: 'yarn' },
        { name: 'NPM', value: 'npm' },
        { name: 'Exit installation', value: 'exit' },
      ],
    });

    if (response.pm === 'exit') {
      return;
    }
    logger.success('initPm', response.pm);

    await pm.init(response.pm);
  }

  // Install SDK
  logger.success('installPackage', '@superfaceai/one-sdk');
  await pm.installPackage('@superfaceai/one-sdk');

  // Prompt user for dotenv installation
  if (
    await confirmPrompt(
      'Superface CLI would like to install dotenv package (https://github.com/motdotla/dotenv#readme).\nThis package is used to load superface secrets from .env file. You can use different one or install it manually later.\nWould you like to install it now?:',
      { default: true }
    )
  ) {
    logger.success('installPackage', 'dotenv');
    await pm.installPackage('dotenv');
  }

  //TODO: SDK token
  //TODO: .env file
  //TODO: get used security
}

async function confirmPrompt(
  message?: string,
  options?: { default?: boolean }
): Promise<boolean> {
  const prompt: { continue: boolean } = await inquirer.prompt({
    name: 'continue',
    message:
      message !== undefined
        ? `${message}`
        : 'Do you want to continue with project setup?:',
    type: 'confirm',
    default: options?.default ?? false,
  });

  return prompt.continue;
}
