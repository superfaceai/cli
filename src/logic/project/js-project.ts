import inquirer from 'inquirer';

import type { ILogger } from '../../common';
import { type UserError } from '../../common/error';
import { stringifyError } from '../../common/error';
import type { IPackageManager } from '../../common/package-manager';
import { dirname } from 'path';
import { exists } from '../../common/io';
import {
  DEFAULT_SUPERFACE_DIR,
  buildSuperfaceDirPath,
} from '../../common/file-structure';

export async function setupJsProject({
  logger,
  pm,
  userError,
}: {
  logger: ILogger;
  pm: IPackageManager;
  userError: UserError;
}) {
  let originalDir: string | undefined;
  // Check directory
  if (dirname(process.cwd()) !== DEFAULT_SUPERFACE_DIR) {
    if (!(await exists(buildSuperfaceDirPath()))) {
      throw userError(
        'Superface directory not found. Please run "superface prepare" first.',
        1
      );
    }

    try {
      originalDir = process.cwd();

      process.chdir('superface');
    } catch (error) {
      throw userError(
        `Error when changing directory: ${stringifyError(error)}`,
        1
      );
    }
  }

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
  await pm.installPackage('@superfaceai/one-sdk@3.0.0-alpha.12');

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

  // TODO: SDK token
  // TODO: .env file
  // TODO: get used security

  if (originalDir !== undefined) {
    process.chdir(originalDir);
  }
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
