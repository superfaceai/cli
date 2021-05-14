import { flags } from '@oclif/command';
import { grey, yellow } from 'chalk';
import { join as joinPath } from 'path';

import { Command } from '../common/command.abstract';
import {
  META_FILE,
  SUPERFACE_DIR,
  validateDocumentName,
} from '../common/document';
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

const parseProviders = (
  providers?: string[],
  options?: { warnCb?: LogCallback }
): string[] => {
  if (!providers) {
    return [];
  }

  return providers.filter(p => {
    if (!validateDocumentName(p)) {
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
    providers: flags.string({
      char: 'p',
      description: 'Provider name.',
      required: false,
      multiple: true,
    }),
    force: flags.boolean({
      char: 'f',
      description:
        'When set to true and when profile exists in local filesystem, overwrites them.',
      default: false,
    }),
    local: flags.boolean({
      char: 'l',
      description:
        'When set to true, profile id argument is used as a filepath to profile.supr file',
      default: false,
    }),
    scan: flags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
    help: flags.help({ char: 'h' }),
  };

  static examples = [
    '$ superface install',
    '$ superface install sms/service@1.0',
    '$ superface install sms/service@1.0 --providers twilio',
    '$ superface install sms/service@1.0 -p twilio',
    '$ superface install --local sms/service.supr',
  ];

  private warnCallback? = (message: string) =>
    this.log('⚠️  ' + yellow(message));

  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Install);

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

    const providers = parseProviders(flags.providers);

    this.logCallback?.(
      `Installing profiles according to 'super.json' on path '${joinPath(
        superPath,
        META_FILE
      )}'`
    );

    const installRequests: (LocalInstallRequest | StoreInstallRequest)[] = [];
    const profileArg = args.profileId as string | undefined;
    if (profileArg !== undefined) {
      if (flags.local) {
        installRequests.push({
          kind: 'local',
          path: profileArg,
        });
      } else {
        const [profileId, version] = profileArg.split('@');

        installRequests.push({
          kind: 'store',
          profileId,
          version,
        });
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
      await installProvider(superPath, providerName, args.profileId, {
        logCb: this.logCallback,
        warnCb: this.warnCallback,
        force: flags.force,
        local: false,
      });
    }
  }
}
