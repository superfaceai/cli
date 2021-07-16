import { flags as oclifFlags } from '@oclif/command';
import { isValidDocumentName, isValidProviderName } from '@superfaceai/ast';
import { bold, green, grey, yellow } from 'chalk';
import { join as joinPath } from 'path';

import { Command } from '../common/command.abstract';
import { META_FILE, SUPERFACE_DIR, trimExtension } from '../common/document';
import { userError } from '../common/error';
import { LogCallback } from '../common/log';
import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import {
  detectSuperJson,
  installProfiles,
  LocalRequest as LocalInstallRequest,
  StoreRequest as StoreInstallRequest,
} from '../logic/install';
import { interactiveInstall } from '../logic/quickstart';

const parseProviders = (
  providers?: string[],
  options?: { warnCb?: LogCallback }
): string[] => {
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
        options?.warnCb?.(`Invalid provider name: ${p}`);

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
      description: `When set to true, command is used in interactive mode. It leads user through profile installation, provider selection, provider security and retry policy setup. Result of this command is ready to use superface configuration.\nSteps of command are:
      \n1) Superface is initialized (if not already initialized)
      \n2) Selected profile installation - if profile already exists user can choose if he wants to override existing installation
      \n3) Select providers and install them. User can choose to override or skip already existing providers
      \n4) If profile contains more than one use case user can select use case to configure
      \n5) If there is more than one provider configured user can choose to enable provider failover (in case of problems with primary provider superface automatically switches to secondary provider)
      \n6) For every selected provider user can choose retry policy he want provider to use. Currently there are two supported retry policies:
      \n\t None: superface won't retry any requests
      \n\t CircuitBreaker: superface will try retry requests, each request has timeout and exponential backoff is used between failed requests. Parameters of circuit breaker can be specifed or left default.
      \n7) Installed providers are configured. User can set enviroment variables needed for provider authorization. These are saved locally in .env file.
      \n8) Package @superfaceai/one-sdk is installed. This package is needed to use superface.
      \n9) Optionally, package dotenv is installed to load .env file
      \n10) Optionally, user can enter his SDK token to connect superface installation with his dashboard and to enable e-mail notifications
      \n11) Superface is configured 🆗. User can follow printed link to get actual code`,
      default: false,
      exclusive: ['providers', 'force', 'local', 'scan', 'quiet'],
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
    '$ superface install sms/service -i',
    '$ superface install sms/service@1.0 -i',
    '$ superface install sms/service@1.0',
    '$ superface install sms/service@1.0 --providers twilio tyntec',
    '$ superface install sms/service@1.0 -p twilio',
    '$ superface install --local sms/service.supr',
  ];

  private warnCallback? = (message: string) =>
    this.log('⚠️  ' + yellow(message));

  private logCallback? = (message: string) => this.log(grey(message));
  private successCallback? = (message: string) =>
    this.log(bold(green(message)));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Install);

    if (flags.interactive) {
      if (!args.profileId) {
        this.warnCallback?.(
          `Profile ID argument must be used with interactive flag`
        );
        this.exit(0);
      }

      await interactiveInstall(args.profileId, {
        logCb: this.logCallback,
        warnCb: this.warnCallback,
        successCb: this.successCallback,
      });

      return;
    }

    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;
    }

    if (flags.scan && (typeof flags.scan !== 'number' || flags.scan > 5)) {
      throw userError(
        '--scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }

    let superPath = await detectSuperJson(process.cwd(), flags.scan);
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

    const providers = parseProviders(flags.providers, {
      warnCb: this.warnCallback,
    });

    this.logCallback?.(
      `Installing profiles according to 'super.json' on path '${joinPath(
        superPath,
        META_FILE
      )}'`
    );

    const installRequests: (LocalInstallRequest | StoreInstallRequest)[] = [];
    const profileArg = args.profileId as string | undefined;
    if (profileArg !== undefined) {
      const [profileId, version] = profileArg.split('@');

      //Prepare profile name
      const profilePathParts = profileId.split('/');
      let profileName: string;

      if (flags.local) {
        installRequests.push({
          kind: 'local',
          path: profileArg,
        });

        profileName = trimExtension(
          profilePathParts[profilePathParts.length - 1]
        );
      } else {
        installRequests.push({
          kind: 'store',
          profileId,
          version,
        });
        profileName = profilePathParts[profilePathParts.length - 1];
      }

      if (!isValidDocumentName(profileName)) {
        this.warnCallback?.(`Invalid profile name: ${profileName}`);
        this.exit();
      }
    } else {
      //Do not install providers without profile
      if (providers.length > 0) {
        this.warnCallback?.(
          'Unable to install providers without profile. Please, specify profile'
        );
        this.exit();
      }
    }

    await installProfiles(superPath, installRequests, {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
      force: flags.force,
    });

    this.logCallback?.(`\n\nConfiguring providers`);
    for (const providerName of providers) {
      await installProvider(
        superPath,
        providerName,
        args.profileId,
        undefined,
        {
          logCb: this.logCallback,
          warnCb: this.warnCallback,
          force: flags.force,
          local: false,
        }
      );
    }
  }
}
