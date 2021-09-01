import { flags } from '@oclif/command';
import { EXTENSIONS } from '@superfaceai/ast';
import { isValidProviderName, SuperJson } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { green, grey, yellow } from 'chalk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { META_FILE } from '../common';
import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { getServicesUrl } from '../common/http';
import { formatShellLog } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import {
  reconfigureProfileProvider,
  reconfigureProvider,
} from '../logic/configure';
import { detectSuperJson } from '../logic/install';
import { publish } from '../logic/publish';
import Install from './install';

export default class Publish extends Command {
  static strict = true;

  static description =
    'Uploads map/profile/provider to Store. Published file must be locally linked in super.json. This command runs Check and Lint internaly to ensure quality';

  static args = [
    {
      name: 'documentType',
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
      required: true,
    }),
    providerName: flags.string({
      description:
        'Name of the provider. This argument is used to publish a map or a provider.',
      required: true,
    }),
    dryRun: flags.boolean({
      default: false,
      description: 'Runs without sending the actual request.',
    }),
    force: flags.boolean({
      char: 'f',
      default: false,
      description: 'Publishes without asking for any confirmation.',
    }),
    scan: flags.integer({
      char: 's',
      description:
        'When a number is provided, scan for super.json outside cwd within the range represented by this number.',
      required: false,
    }),
    json: flags.boolean({
      char: 'j',
      description: 'Formats result to JSON',
    }),
  };

  static examples = [
    '$ superface publish map --profileId starwars/characeter-information --providerName swapi -s 4',
    '$ superface publish profile --profileId starwars/characeter-information --providerName swapi -f',
    '$ superface publish provider --profileId starwars/characeter-information --providerName swapi -q',
    '$ superface publish profile --profileId starwars/characeter-information --providerName swapi --dryRun',
  ];

  private logCallback? = (message: string) => this.log(grey(message));
  private warnCallback? = (message: string) => this.log(yellow(message));
  private successCallback? = (message: string) => this.log(green(message));

  async run(): Promise<void> {
    const { argv, flags } = this.parse(Publish);

    const documentType = argv[0];

    if (!flags.force) {
      const response: { upload: boolean } = await inquirer.prompt({
        name: 'upload',
        message: `Are you sure that you want to publish data to ${getServicesUrl()} registry?`,
        type: 'confirm',
      });

      if (!response.upload) {
        this.exit(0);
      }
    }

    if (flags.quiet) {
      this.logCallback = undefined;
      this.successCallback = undefined;
      this.warnCallback = undefined;
    }

    // Check inputs
    const parsedProfileId = parseDocumentId(flags.profileId);
    if (parsedProfileId.kind == 'error') {
      throw userError(`❌ Invalid profile id: ${parsedProfileId.message}`, 1);
    }

    if (!isValidProviderName(flags.providerName)) {
      throw userError(`❌ Invalid provider name: "${flags.providerName}"`, 1);
    }

    if (flags.scan && (typeof flags.scan !== 'number' || flags.scan > 5)) {
      throw userError(
        '❌ --scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }

    //Load super json
    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (!superPath) {
      throw userError('❌ Unable to publish, super.json not found', 1);
    }
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(
          `❌ Unable to load super.json: ${err.formatShort()}`,
          1
        );
      }
    );

    //Check if there is defined capability in super.json
    const profileSettings = superJson.normalized.profiles[flags.profileId];
    if (!profileSettings) {
      throw userError(
        `❌ Unable to publish, profile: "${flags.profileId}" not found in super.json`,
        1
      );
    }
    const profileProviderSettings =
      profileSettings.providers[flags.providerName];
    if (!profileProviderSettings) {
      throw userError(
        `❌ Unable to publish, provider: "${flags.providerName}" not found in profile: "${flags.profileId}" in super.json`,
        1
      );
    }

    const providerSettings = superJson.normalized.providers[flags.providerName];
    if (!providerSettings) {
      throw userError(
        `❌ Unable to publish, provider: "${flags.providerName}" not found in super.json`,
        1
      );
    }

    //Publishing profile
    if (documentType === 'profile') {
      if (!('file' in profileSettings)) {
        throw userError(
          `❌ When publishing profile, profile must be locally linked in super.json`,
          1
        );
      }
      if (!profileSettings.file.endsWith(EXTENSIONS.profile.source)) {
        throw userError(
          `❌ Profile path: "${profileSettings.file}" must leads to "${EXTENSIONS.profile.source}" file`,
          1
        );
      }

      //Publishing map
    } else if (documentType === 'map') {
      if (!('file' in profileProviderSettings)) {
        throw userError(
          `❌ When publishing map, map must be locally linked in super.json`,
          1
        );
      }
      if (!profileProviderSettings.file.endsWith(EXTENSIONS.map.source)) {
        throw userError(
          `❌ Map path: "${profileProviderSettings.file}" must leads to "${EXTENSIONS.map.source}" file`,
          1
        );
      }

      //Publishing provider
    } else if (documentType === 'provider') {
      if (!('file' in providerSettings) || !providerSettings.file) {
        throw userError(
          `❌ When publishing provider, provider must be locally linked in super.json`,
          1
        );
      }
      if (!providerSettings.file.endsWith('.json')) {
        throw userError(
          `❌ Provider path: "${providerSettings.file}" must leads to ".json" file`,
          1
        );
      }
    } else {
      throw userError(
        '❌ Document type must be one of "map", "profile", "provider"',
        1
      );
    }

    const version =
      'version' in profileSettings ? profileSettings.version : undefined;

    const map = {
      variant:
        'mapVariant' in profileProviderSettings
          ? profileProviderSettings.mapVariant
          : undefined,
    };

    const result = await publish(
      documentType,
      superJson,
      ProfileId.fromId(flags.profileId),
      flags.providerName,
      map,
      version,
      {
        logCb: this.logCallback,
        dryRun: flags.dryRun,
        json: flags.json,
        quiet: flags.quiet,
      }
    );
    if (result) {
      this.warnCallback?.('❌ Publishing command ended up with errors:\n');
      this.log(result);

      return;
    }

    this.successCallback?.(
      `🆗 ${documentType} has been published successfully.`
    );
    let transition = true;
    if (!flags.force) {
      const prompt: { continue: boolean } = await inquirer.prompt({
        name: 'continue',
        message: `Do you want to switch to remote ${documentType} instead of a locally linked one?:`,
        type: 'confirm',
        default: true,
      });
      transition = prompt.continue;
    }
    if (transition) {
      if (documentType === 'profile') {
        await Install.run([flags.profileId, '-f']);

        return;
      }
      if (documentType === 'map') {
        await reconfigureProfileProvider(
          superJson,
          ProfileId.fromId(flags.profileId),
          flags.providerName,
          {
            kind: 'remote',
          }
        );
      }
      if (documentType === 'provider') {
        await reconfigureProvider(superJson, flags.providerName, {
          kind: 'remote',
        });
      }
      await OutputStream.writeOnce(superJson.path, superJson.stringified, {
        force: flags.force,
      });

      this.logCallback?.(
        formatShellLog("echo '<updated super.json>' >", [superJson.path])
      );
    }
  }
}
