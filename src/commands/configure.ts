import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/one-sdk';
import { grey, yellow } from 'chalk';
import { join as joinPath } from 'path';

import { Command } from '../common/command.abstract';
import { META_FILE, SUPERFACE_DIR } from '../common/document';
import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import { detectSuperJson } from '../logic/install';

export default class Configure extends Command {
  static description =
    'Automatically initializes superface directory in current working directory if needed, communicates with Superface Store API, stores provider configuration in super.json';

  static args = [
    {
      name: 'providerName',
      required: true,
      description: 'Provider name.',
    },
  ];

  static flags = {
    ...Command.flags,
    profile: oclifFlags.string({
      char: 'p',
      description: 'Specifies profile to associate with provider',
      required: true,
    }),
    force: oclifFlags.boolean({
      char: 'f',
      description:
        'When set to true and when provider exists in super.json, overwrites them.',
      default: false,
    }),
    local: oclifFlags.boolean({
      char: 'l',
      description:
        'When set to true, provider name argument is used as a filepath to provider.json file',
      default: false,
    }),
  };

  static examples = [
    '$ superface configure twilio -p send-sms',
    '$ superface configure twilio -p send-sms -q',
    '$ superface configure twilio -p send-sms -f',
    '$ superface configure providers/twilio.provider.json -p send-sms -l',
  ];

  private warnCallback?= (message: string) => this.log(yellow(message));
  private logCallback?= (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Configure);

    if (flags.quiet) {
      this.warnCallback = undefined;
      this.logCallback = undefined;
    }

    if (!isValidProviderName(args.providerName) && !flags.local) {
      this.warnCallback?.('Invalid provider name');

      return;
    }

    let superPath = await detectSuperJson(process.cwd());

    if (!superPath) {
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
    await installProvider(superPath, args.providerName, flags.profile.trim(), undefined, {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
      force: flags.force,
      local: flags.local,
    });
  }
}
