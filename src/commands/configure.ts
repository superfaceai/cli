import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/ast';
import { join as joinPath } from 'path';

import { Command, Flags } from '../common/command.abstract';
import { META_FILE, SUPERFACE_DIR } from '../common/document';
import { UserError } from '../common/error';
import { exists } from '../common/io';
import { ILogger } from '../common/log';
import { ProfileId } from '../common/profile';
import { isCompatible } from '../logic';
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
    ['write-env']: oclifFlags.boolean({
      description:
        'When set to true command writes security variables to .env file',
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

  async run(): Promise<void> {
    const { flags, args } = this.parse(Configure);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
      args,
    });
  }

  async execute({
    logger,
    userError,
    flags,
    args,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Configure.flags>;
    args: { providerName?: string };
  }): Promise<void> {
    if (
      args.providerName === undefined ||
      !isValidProviderName(args.providerName)
    ) {
      throw userError('Invalid provider name', 1);
    }

    if (flags.localMap && !(await exists(flags.localMap))) {
      throw userError(`Local path: "${flags.localMap}" does not exist`, 1);
    }

    if (flags.localProvider && !(await exists(flags.localProvider))) {
      throw userError(`Local path: "${flags.localProvider}" does not exist`, 1);
    }

    const profileId = ProfileId.fromId(flags.profile.trim(), { userError });
    const provider = args.providerName;

    if (provider !== undefined && !flags.localMap && !flags.localProvider) {
      if (!(await isCompatible(flags.profile.trim(), [provider], { logger }))) {
        this.exit();
      }
    }

    let superPath = await detectSuperJson(process.cwd());

    if (!superPath) {
      logger.info('initSuperface');

      await initSuperface(
        { appPath: './', initialDocument: { profiles: {}, providers: {} } },
        { logger }
      );
      superPath = SUPERFACE_DIR;
    }

    logger.info('configureProviderToSuperJson', joinPath(superPath, META_FILE));
    await installProvider(
      {
        superPath,
        provider,
        profileId,
        defaults: undefined,
        options: {
          force: flags.force,
          localMap: flags.localMap,
          localProvider: flags.localProvider,
          updateEnv: flags['write-env'],
        },
      },
      { logger, userError }
    );
  }
}
