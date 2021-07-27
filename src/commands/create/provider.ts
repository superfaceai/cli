import { flags as oclifFlags } from '@oclif/command';
import { SuperJson } from '@superfaceai/one-sdk';
import { grey, yellow } from 'chalk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { META_FILE, SUPERFACE_DIR } from '../../common';
import { Command } from '../../common/command.abstract';
import { developerError } from '../../common/error';
import { formatShellLog } from '../../common/log';
import { OutputStream } from '../../common/output-stream';
import { NORMALIZED_CWD_PATH } from '../../common/path';
import { createProviderJson } from '../../logic/create';
import { initSuperface } from '../../logic/init';
import { detectSuperJson } from '../../logic/install';

export default class CreateProvider extends Command {
  static strict = false;

  static description = 'Creates empty provider on a local filesystem.';

  static args = [
    {
      name: 'provider',
      required: true,
      description: 'Name of a Provider',
    },
  ];

  static flags = {
    ...Command.flags,
    variant: oclifFlags.string({
      char: 't',
      description: 'Variant of a map',
      required: false,
    }),
    template: oclifFlags.string({
      options: ['empty', 'pubs'],
      default: 'empty',
      description: 'Template to initialize the usecases and maps with',
    }),
    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
  };

  static examples = [
    '$ superface create:provider twilio',
    '$ superface create:provider twilio -t bugfix',
    '$ superface create:provider twilio -s 3',
    '$ superface create:provider twilio --template pubs',
  ];

  private warnCallback? = (message: string) => this.log(yellow(message));
  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { argv, flags } = this.parse(CreateProvider);

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
        this.exit(0);
      }

      this.logCallback?.(
        "Initializing superface directory with empty 'super.json'"
      );
      await initSuperface(
        NORMALIZED_CWD_PATH,
        { profiles: {}, providers: {} },
        { logCb: this.logCallback }
      );
      superPath = SUPERFACE_DIR;
    }
    // typecheck the template flag
    switch (flags.template) {
      case 'empty':
      case 'pubs':
        break;
      default:
        throw developerError('Invalid --template flag option', 1);
    }

    //Load super json
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));

    const superJson = loadedResult.match(
      v => v,
      err => {
        this.warnCallback?.(err);

        return new SuperJson({});
      }
    );

    await createProviderJson('', superJson, argv[0], flags.template, {
      logCb: this.logCallback,
    });

    // write new information to super.json
    await OutputStream.writeOnce(superJson.path, superJson.stringified);
    this.logCallback?.(
      formatShellLog("echo '<updated super.json>' >", [superJson.path])
    );
  }
}
