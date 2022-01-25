import { flags as oclifFlags } from '@oclif/command';
import { isValidDocumentName, isValidProviderName } from '@superfaceai/ast';
import { join as joinPath } from 'path';

import { Command, Flags } from '../common/command.abstract';
import { META_FILE, SUPERFACE_DIR } from '../common/document';
import { UserError } from '../common/error';
import { ILogger } from '../common/log';
import { IPackageManager, PackageManager } from '../common/package-manager';
import { NORMALIZED_CWD_PATH } from '../common/path';
import { ProfileId } from '../common/profile';
import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import {
  detectSuperJson,
  installProfiles,
  LocalRequest as LocalInstallRequest,
  StoreRequest as StoreInstallRequest,
} from '../logic/install';
import { interactiveInstall } from '../logic/quickstart';

const parseProviders = (logger: ILogger, providers?: string[]): string[] => {
  if (!providers) {
    return [];
  }

  return providers
    .flatMap(provider => provider.split(','))
    .map(p => p.trim())
    .filter(p => {
      if (p === '') {
        return false;
      }
      if (!isValidProviderName(p)) {
        logger.warn('invalidProviderName', p);

        return false;
      }

      return true;
    });
};

export default class Install extends Command {
  static description =
    'Automatically initializes superface directory in current working directory if needed, communicates with Superface Store API, stores profiles and compiled files to a local system. Install without any arguments tries to install profiles and providers listed in super.json';

  static args = [
    {
      name: 'profileId',
      required: false,
      description:
        'Profile identifier consisting of scope (optional), profile name and its version.',
      default: undefined,
    },
  ];

  static flags = {
    ...Command.flags,
    providers: oclifFlags.string({
      char: 'p',
      description: 'Provider name.',
      required: false,
      multiple: true,
    }),
    force: oclifFlags.boolean({
      char: 'f',
      description:
        'When set to true and when profile exists in local filesystem, overwrites them.',
      default: false,
    }),
    local: oclifFlags.boolean({
      char: 'l',
      description:
        'When set to true, profile id argument is used as a filepath to profile.supr file.',
      default: false,
    }),
    interactive: oclifFlags.boolean({
      char: 'i',
      description:
        'When set to true, command is used in interactive mode. It leads users through profile installation, provider selection, provider security and retry policy setup. Result of this command is ready to use superface configuration.',
      default: false,
      exclusive: ['providers', 'force', 'local', 'scan', 'quiet'],
      hidden: true,
    }),
    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
    help: oclifFlags.help({ char: 'h' }),
  };

  static examples = [
    '$ superface install',
    '$ superface install sms/service@1.0',
    '$ superface install sms/service@1.0 --providers twilio tyntec',
    '$ superface install sms/service@1.0 -p twilio',
    '$ superface install --local sms/service.supr',
  ];

  async run(): Promise<void> {
    const { flags, args } = this.parse(Install);
    await super.initialize(flags);
    const pm = new PackageManager(this.logger);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      pm,
      flags,
      args,
    });
  }

  async execute({
    logger,
    userError,
    pm,
    flags,
    args,
  }: {
    logger: ILogger;
    userError: UserError;
    pm: IPackageManager;
    flags: Flags<typeof Install.flags>;
    args: { profileId?: string };
  }): Promise<void> {
    if (flags.scan && (typeof flags.scan !== 'number' || flags.scan > 5)) {
      throw userError(
        '--scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }

    if (flags.interactive) {
      if (!args.profileId) {
        logger.warn('missingInteractiveFlag');
        this.exit(1);
      }

      await interactiveInstall(args.profileId, { logger, pm, userError });

      return;
    }

    let superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (!superPath) {
      logger.info('initSuperface');
      await initSuperface(
        {
          appPath: NORMALIZED_CWD_PATH,
          initialDocument: { profiles: {}, providers: {} },
        },
        { logger }
      );
      superPath = SUPERFACE_DIR;
    }

    const providers = parseProviders(logger, flags.providers);

    logger.info('installProfilesToSuperJson', joinPath(superPath, META_FILE));

    const requests: (LocalInstallRequest | StoreInstallRequest)[] = [];
    const profileArg = args.profileId;
    if (profileArg !== undefined) {
      if (flags.local) {
        requests.push({
          kind: 'local',
          path: profileArg,
        });
      } else {
        const [id, version] = profileArg.split('@');
        const profileId = ProfileId.fromId(id, { userError });

        if (!isValidDocumentName(profileId.name)) {
          logger.warn('invalidProfileName', profileId.name);
          this.exit();
        }

        requests.push({
          kind: 'store',
          profileId,
          version,
        });
      }
    } else {
      //Do not install providers without profile
      if (providers.length > 0) {
        logger.warn('unableToInstallWithoutProfile');
        this.exit();
      }
    }

    await installProfiles(
      {
        superPath,
        requests,
        options: {
          force: !!flags.force,
          tryToAuthenticate: true,
        },
      },
      { logger, userError }
    );
    if (providers.length > 0) {
      logger.info('configuringProviders');
    }
    for (const provider of providers) {
      await installProvider(
        {
          superPath,
          provider,
          profileId: ProfileId.fromId(profileArg as string, { userError }),
          defaults: undefined,
          options: {
            force: !!flags.force,
          },
        },
        { logger, userError }
      );
    }
  }
}
