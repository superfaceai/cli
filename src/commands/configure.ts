import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/one-sdk';
import { grey, yellow } from 'chalk';
import { join as joinPath } from 'path';

import { Command } from '../common/command.abstract';
import { META_FILE, SUPERFACE_DIR } from '../common/document';
import { userError } from '../common/error';
import { exists } from '../common/io';
import { ProfileId } from '../common/profile';
import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import { detectSuperJson } from '../logic/install';

export default class Configure extends Command {
  static description =
    'Configures new provider and map for already installed profile. Provider configuration is dowloaded from a Superface registry or from local file.';

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
    env: oclifFlags.boolean({
      description:
        'When set to true command prepares security varibles in .env file',
      default: false,
    }),
    force: oclifFlags.boolean({
      char: 'f',
      description:
        'When set to true and when provider exists in super.json, overwrites them.',
      default: false,
    }),
    localProvider: oclifFlags.string({
      description: 'Optional filepath to provider.json file',
    }),
    localMap: oclifFlags.string({
      description: 'Optional filepath to .suma map file',
    }),
  };

  static examples = [
    '$ superface configure twilio -p send-sms',
    '$ superface configure twilio -p send-sms -q',
    '$ superface configure twilio -p send-sms -f',
    '$ superface configure twilio -p send-sms --localProvider providers/twilio.provider.json',
    '$ superface configure twilio -p send-sms --localMap maps/send-sms.twilio.suma',
  ];

  private warnCallback? = (message: string) => this.log(yellow(message));
  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Configure);

    if (flags.quiet) {
      this.warnCallback = undefined;
      this.logCallback = undefined;
    }

    if (!isValidProviderName(args.providerName)) {
      throw userError('Invalid provider name', 1);
    }

    if (flags.localMap && !(await exists(flags.localMap))) {
      throw userError(`Local path: "${flags.localMap}" does not exist`, 1);
    }

    if (flags.localProvider && !(await exists(flags.localProvider))) {
      throw userError(`Local path: "${flags.localProvider}" does not exist`, 1);
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
    await installProvider({
      superPath,
      provider: args.providerName as string,
      profileId: ProfileId.fromId(flags.profile.trim()),
      defaults: undefined,
      options: {
        logCb: this.logCallback,
        warnCb: this.warnCallback,
        force: flags.force,
        localMap: flags.localMap,
        localProvider: flags.localProvider,
        updateEnv: flags.env,
      },
    });
  }
}
