import { Command, flags } from '@oclif/command';
import { grey, yellow } from 'chalk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { META_FILE, SUPERFACE_DIR } from '../common/document';
import { initSuperface } from '../logic/init';
import { detectSuperJson, installProfiles } from '../logic/install';

export default class Install extends Command {
  static description =
    'Initializes superface directory if needed, communicates with Superface registry, stores profiles and ASTs to a local system';

  static args = [
    {
      name: 'profileId',
      required: false,
      description:
        'Profile identifier consisting of scope (optional), profile name and its version.',
    },
  ];

  static flags = {
    provider: flags.string({
      char: 'p',
      description: 'Provider name.',
      required: false,
    }),
    quiet: flags.boolean({
      char: 'q',
      description:
        'When set to true, disables the shell echo output of init actions.',
      default: false,
    }),
    force: flags.boolean({
      char: 'f',
      description:
        'When set to true and when profile exists in local filesystem, overwrites them.',
      default: false,
    }),
    scan: flags.integer({
      char: 's',
      description:
        'When number provided, scan outside cwd within range represented by this number.',
      required: false,
    }),
    help: flags.help({ char: 'h' }),
  };

  static examples = [
    '$ superface install',
    '$ superface install --provider twillio',
    '$ superface install sms/service@1.0',
    '$ superface install sms/service@1.0 -p twillio',
  ];

  private warnCallback? = (message: string) => this.log(yellow(message));
  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Install);

    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;
    }

    let superPath = await detectSuperJson(process.cwd(), flags.scan);

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
        "Initializing superface directory with empty 'super.json'..."
      );
      await initSuperface(
        './',
        { profiles: {}, providers: {} },
        { logCb: this.logCallback }
      );
      superPath = SUPERFACE_DIR;
    }

    this.logCallback?.(
      `Installing profiles according to 'super.json' on path '${joinPath(
        superPath,
        META_FILE
      )}'`
    );
    await installProfiles(superPath, args.profileId, flags.provider, {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
      force: flags.force,
    });

    // TODO: generate typings to <appPath>/superface/types
  }
}
