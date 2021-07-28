import { flags as oclifFlags } from '@oclif/command';
import { SuperJson } from '@superfaceai/one-sdk';
import { grey, yellow } from 'chalk';
import { join as joinPath } from 'path';

import { META_FILE } from '../../common';
import { Command } from '../../common/command.abstract';
import { userError } from '../../common/error';
import { formatShellLog } from '../../common/log';
import { OutputStream } from '../../common/output-stream';
import { createProviderJson } from '../../logic/create';

export default class CreateProvider extends Command {
  static strict = false;

  static description = 'Creates empty provider on a local filesystem.';

  static args = [
    {
      name: 'providerName',
      required: true,
      description: 'Name of a provider',
    },
  ];

  static flags = {
    ...Command.flags,
    variant: oclifFlags.string({
      char: 't',
      description: 'Variant of a map',
      required: false,
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

    //Check input
    const documentName = argv[0];

    if (documentName === 'profile' || documentName === 'map') {
      throw userError('Name of your document is reserved!', 1);
    }

    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;
    }
    const superPath = await this.getSuperPath(flags.scan, {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
    });

    //Load super json
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));

    const superJson = loadedResult.match(
      v => v,
      err => {
        this.warnCallback?.(err);

        return new SuperJson({});
      }
    );

    await createProviderJson('', superJson, documentName, {
      logCb: this.logCallback,
    });

    // write new information to super.json
    await OutputStream.writeOnce(superJson.path, superJson.stringified);
    this.logCallback?.(
      formatShellLog("echo '<updated super.json>' >", [superJson.path])
    );
  }
}
