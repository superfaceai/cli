import { flags } from '@oclif/command';
import { SuperJson } from '@superfaceai/one-sdk';
import { grey } from 'chalk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { META_FILE } from '../common';
import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { getStoreUrl } from '../common/http';
import { detectSuperJson } from '../logic/install';
import { publish } from '../logic/publish';

export default class Publish extends Command {
  static strict = false;

  static description =
    'Uploads map/profile/provider to Store. Published file must be locally linked in super.json';

  static args = [
    {
      name: 'path',
      description: 'Document type of publeshed file',
      options: ['map', 'profile', 'provider'],
      required: true,
    },
  ];

  static flags = {
    ...Command.flags,
    //Inputs
    profileId: flags.string({
      description: 'Profile Id in format [scope/](optional)[name]',
    }),
    providerName: flags.string({
      description:
        'Name of provider. This argument is used to publish map or provider',
    }),
    'dry-run': flags.boolean({
      default: false,
      description: 'Runs without sending actual request.',
    }),
    force: flags.boolean({
      char: 'f',
      default: false,
      description: 'Publishes without asking any confirmation.',
    }),
    scan: flags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
  };

  static examples = [
    '$ station publish capabilities/vcs/user-repos/maps/bitbucket.suma -f',
    '$ station publish capabilities/vcs/user-repos/maps/bitbucket.suma -q',
    '$ station publish capabilities/vcs/user-repos/maps/bitbucket.suma --dry-run',
  ];

  private logCallback? = (message: string) => this.log(grey(message));
  // private warnCallback?= (message: string) => this.log(yellow(message));
  // private successCallback?= (message: string) => this.log(green(message));

  async run(): Promise<void> {
    const { argv, flags } = this.parse(Publish);

    const documentType = argv[0];

    if (!flags.force) {
      const response: { upload: boolean } = await inquirer.prompt({
        name: 'upload',
        message: `Are you sure that you want to publish data to ${getStoreUrl()} registry?`,
        type: 'confirm',
      });

      if (!response.upload) {
        this.exit(0);
      }
    }

    if (flags.quiet) {
      this.logCallback = undefined;
      // this.successCallback = undefined;
      // this.warnCallback = undefined;
    }

    //Load super json
    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (!superPath) {
      throw userError('Unable to publish, super.json not found', 1);
    }
    //Load super json
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err}`, 1);
      }
    );
    let path: string;

    //Publishing profile
    if (documentType === 'profile') {
      if (!flags.profileId) {
        throw userError(
          '--profileId must be specified when publishing profile',
          1
        );
      }
      const profileSettings = superJson.normalized.profiles[flags.profileId];
      if (!profileSettings) {
        throw userError(
          `Unable to publish, profile ${flags.profileId} not found in super.json`,
          1
        );
      }
      if (!('file' in profileSettings)) {
        throw userError(
          `When publishing profile, profile must be locally linked in super.json`,
          1
        );
      }
      path = profileSettings.file;

      //Publishing map
    } else if (documentType === 'map') {
      if (!flags.profileId) {
        throw userError('--profileId must be specified when publishing map', 1);
      }
      if (!flags.providerName) {
        throw userError(
          '--providerName must be specified when publishing map',
          1
        );
      }
      const profileSettings = superJson.normalized.profiles[flags.profileId];
      if (!profileSettings) {
        throw userError(
          `Unable to publish, profile ${flags.profileId} not found in super.json`,
          1
        );
      }
      const profileProviderSettings =
        profileSettings.providers[flags.providerName];
      if (!profileProviderSettings) {
        throw userError(
          `Unable to publish, provider: "${flags.providerName}" not found in profile ${flags.profileId} in super.json`,
          1
        );
      }
      if (!('file' in profileProviderSettings)) {
        throw userError(
          `When publishing map, map must be locally linked in super.json`,
          1
        );
      }
      path = profileProviderSettings.file;

      //Publishing provider
    } else if (documentType === 'provider') {
      if (!flags.providerName) {
        throw userError(
          '--providerName must be specified when publishing provider',
          1
        );
      }
      const providerSettings =
        superJson.normalized.providers[flags.providerName];
      if (!providerSettings) {
        throw userError(
          `Unable to publish, provider: "${flags.providerName}" not found in super.json`,
          1
        );
      }
      if (!('file' in providerSettings) || !providerSettings.file) {
        throw userError(
          `When publishing provider, provider must be locally linked in super.json`,
          1
        );
      }
      path = providerSettings.file;
    } else {
      throw userError(
        'Document type must be one of "map", "profile", "provider"',
        1
      );
    }
    //TODO: Lint
    //TODO: Check
    //TODO: Test

    await publish(path, {
      logCb: this.logCallback,
      dryRun: flags['dry-run'],
    });
  }
}
