import { Command as OclifCommand, flags } from '@oclif/command';
import inquirer from 'inquirer';

import { initSuperface } from '../logic/init';
import { detectSuperJson } from '../logic/install';
import { SUPERFACE_DIR } from './document';
import { LogCallback } from './log';
import { NORMALIZED_CWD_PATH } from './path';

export abstract class Command extends OclifCommand {
  static flags = {
    quiet: flags.boolean({
      char: 'q',
      description:
        'When set to true, disables the shell echo output of init actions.',
      default: false,
    }),
    help: flags.help({ char: 'h' }),
  };

  public async getSuperPath(
    level?: number,
    options?: {
      logCb?: LogCallback;
      warnCb?: LogCallback;
    }
  ): Promise<string> {
    let superPath = await detectSuperJson(process.cwd(), level);

    if (!superPath) {
      options?.warnCb?.("File 'super.json' has not been found.");

      const response: { init: boolean } = await inquirer.prompt({
        name: 'init',
        message: 'Would you like to initialize new superface structure?',
        type: 'confirm',
      });

      if (!response.init) {
        this.exit();
      }

      options?.logCb?.(
        "Initializing superface directory with empty 'super.json'"
      );
      await initSuperface(
        NORMALIZED_CWD_PATH,
        { profiles: {}, providers: {} },
        { logCb: options?.logCb }
      );
      superPath = SUPERFACE_DIR;
    }

    return superPath;
  }
}
