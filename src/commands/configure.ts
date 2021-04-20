import { flags } from '@oclif/command';
import { grey, yellow } from 'chalk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { Command } from '../common/command.abstract';
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
    ...Command.flags,
    profile: flags.string({
      char: 'p',
      description: 'Specifies profile to associate with provider',
      required: true,
    }),
    force: flags.boolean({
      char: 'f',
      description:
        'When set to true and when provider exists in super.json, overwrites them.',
      default: false,
    }),
    local: flags.boolean({
      char: 'l',
      description:
        'When set to true, provider name argument is used as a filepath to provider.json file',
      default: false,
    }),
  };

  static examples = [
    '$ superface configure twilio -p send-sms',
    '$ superface configure twilio -q',
    '$ superface configure twilio -f',
    '$ superface configure twilio -l',
  ];

  private warnCallback? = (message: string) => this.log(yellow(message));
  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Configure);

    if (flags.quiet) {
      this.warnCallback = undefined;
      this.logCallback = undefined;
    }

    if (!validateDocumentName(args.providerName) && !flags.local) {
      this.warnCallback?.('Invalid provider name');

      return;
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
    await installProvider(superPath, args.providerName, flags.profile.trim(), {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
      force: flags.force,
      local: flags.local,
    });
  }
}
