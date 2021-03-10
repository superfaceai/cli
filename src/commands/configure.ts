import { Command, flags } from '@oclif/command';
import { grey, yellow } from 'chalk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import {
  META_FILE,
  SUPERFACE_DIR,
  validateDocumentName,
} from '../common/document';
import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import { detectSuperJson } from '../logic/install';

export default class Configure extends Command {
  static description =
    'Initializes superface directory if needed, communicates with Superface Store API, stores provider configuration in super.json';

  static args = [
    {
      name: 'providerName',
      required: true,
      description: 'Provider name.',
    },
  ];

  static flags = {
    quiet: flags.boolean({
      char: 'q',
      description:
        'When set to true, disables the shell echo output of init actions.',
      default: false,
    }),
    force: flags.boolean({
      char: 'F',
      description:
        'When set to true and when provider exists in super.json, overwrites them.',
      default: false,
    }),
    file: flags.boolean({
      char: 'f', //FIX char conflict with force - remove/rename force?
      description:
        'When set to true, provider name argument is used as a filepath to provider.json file', //FIX description?
      default: false,
    }),
    help: flags.help({ char: 'h' }),
  };

  static examples = [
    '$ superface configure twillio',
    '$ superface configure twillio -q',
    '$ superface configure twillio -f',
  ];

  private warnCallback? = (message: string) => this.log(yellow(message));
  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Configure);

    if (!validateDocumentName(args.providerName) && !flags.file) {
      this.warnCallback?.('Invalid provider name');

      return;
    }
    if (flags.quiet) {
      this.warnCallback = undefined;
      this.logCallback = undefined;
    }

    let superPath = await detectSuperJson(process.cwd());

    if (!superPath) {
      this.warnCallback?.("File 'super.json' has not been found.");

      const response: { init: boolean } = await inquirer.prompt({
        name: 'init',
        message: 'Would you like to initialize new superface structure?',
        type: 'confirm',
      });

      if (!response.init) {
        this.exit();
      }

      this.logCallback?.(
        "Initializing superface directory with empty 'super.json'"
      );
      await initSuperface(
        './',
        { profiles: {}, providers: {} },
        { logCb: this.logCallback }
      );
      superPath = SUPERFACE_DIR;
    }

    this.logCallback?.(
      `Installing provider to 'super.json' on path '${joinPath(
        superPath,
        META_FILE
      )}'`
    );
    await installProvider(superPath, args.providerName, {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
      force: flags.force,
      file: flags.file,
    });
  }
}
