import { flags } from '@oclif/command';
import { EXTENSIONS, isValidProviderName } from '@superfaceai/ast';
import {
  loadSuperJson,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { META_FILE, UNVERIFIED_PROVIDER_PREFIX } from '../common';
import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { getServicesUrl } from '../common/http';
import type { ILogger } from '../common/log';
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
  public static strict = true;

  public static description =
    'Uploads map/profile/provider to Store. Published file must be locally linked in super.json. This command runs Check and Lint internaly to ensure quality';

  public static args = [
    {
      name: 'documentType',
      description: 'Document type of published file',
      options: ['map', 'profile', 'provider'],
      required: true,
    },
  ];

  public static flags = {
    ...Command.flags,
    // Inputs
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

  public static examples = [
    '$ superface publish map --profileId starwars/character-information --providerName swapi -s 4',
    '$ superface publish profile --profileId starwars/character-information --providerName swapi -f',
    '$ superface publish provider --profileId starwars/character-information --providerName swapi -q',
    '$ superface publish profile --profileId starwars/character-information --providerName swapi --dryRun',
  ];

  public async run(): Promise<void> {
    const { argv, flags } = this.parse(Publish);
    await super.initialize(flags);

    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
      argv,
    });
  }

  public async execute({
    logger,
    userError,
    flags,
    argv,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Publish.flags>;
    argv: string[];
  }): Promise<void> {
    const documentType = argv[0];

    // Check inputs
    const parsedProfileId = parseDocumentId(flags.profileId);
    if (parsedProfileId.kind == 'error') {
      throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
    }

    if (!isValidProviderName(flags.providerName)) {
      throw userError(`Invalid provider name: "${flags.providerName}"`, 1);
    }

    if (
      flags.scan !== undefined &&
      (typeof flags.scan !== 'number' || flags.scan > 5)
    ) {
      throw userError(
        '--scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }

    // Load super json
    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (superPath === undefined) {
      throw userError('Unable to publish, super.json not found', 1);
    }
    const superJsonPath = joinPath(superPath, META_FILE);
    const loadedResult = await loadSuperJson(superJsonPath, NodeFileSystem);
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err.formatShort()}`, 1);
      }
    );

    // Check if there is defined capability in super.json
    const normalized = normalizeSuperJsonDocument(superJson);
    const profileSettings = normalized.profiles[flags.profileId];
    if (profileSettings === undefined) {
      throw userError(
        `Unable to publish, profile: "${flags.profileId}" not found in super.json`,
        1
      );
    }
    const profileProviderSettings =
      profileSettings.providers[flags.providerName];
    if (profileProviderSettings === undefined) {
      throw userError(
        `Unable to publish, provider: "${flags.providerName}" not found in profile: "${flags.profileId}" in super.json`,
        1
      );
    }

    const providerSettings = normalized.providers[flags.providerName];
    if (providerSettings === undefined) {
      throw userError(
        `Unable to publish, provider: "${flags.providerName}" not found in super.json`,
        1
      );
    }

    // Publishing profile
    if (documentType === 'profile') {
      if (!('file' in profileSettings)) {
        throw userError(
          'When publishing profile, profile must be locally linked in super.json',
          1
        );
      }
      if (!profileSettings.file.endsWith(EXTENSIONS.profile.source)) {
        throw userError(
          `Profile path: "${profileSettings.file}" must leads to "${EXTENSIONS.profile.source}" file`,
          1
        );
      }

      // Publishing map
    } else if (documentType === 'map') {
      if (!('file' in profileProviderSettings)) {
        throw userError(
          'When publishing map, map must be locally linked in super.json',
          1
        );
      }
      if (!profileProviderSettings.file.endsWith(EXTENSIONS.map.source)) {
        throw userError(
          `Map path: "${profileProviderSettings.file}" must leads to "${EXTENSIONS.map.source}" file`,
          1
        );
      }
      // Publishing provider
    } else if (documentType === 'provider') {
      if (!flags.providerName.startsWith(UNVERIFIED_PROVIDER_PREFIX)) {
        throw userError(
          `When publishing provider, provider must have prefix "${UNVERIFIED_PROVIDER_PREFIX}"`,
          1
        );
      }
      if (
        !('file' in providerSettings) ||
        providerSettings.file === undefined
      ) {
        throw userError(
          'When publishing provider, provider must be locally linked in super.json',
          1
        );
      }
      if (!providerSettings.file.endsWith('.json')) {
        throw userError(
          `Provider path: "${providerSettings.file}" must leads to ".json" file`,
          1
        );
      }
    } else {
      throw userError(
        'Document type must be one of "map", "profile", "provider"',
        1
      );
    }

    if (flags.force !== true) {
      const response: { upload: boolean } = await inquirer.prompt({
        name: 'upload',
        message: `Are you sure that you want to publish data to ${getServicesUrl()} registry?`,
        type: 'confirm',
      });

      if (!response.upload) {
        this.exit(0);
      }
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
      {
        publishing: documentType,
        superJson,
        superJsonPath,
        profile: ProfileId.fromId(flags.profileId, { userError }),
        provider: flags.providerName,
        map,
        version,
        options: {
          dryRun: flags.dryRun,
          json: flags.json,
          quiet: flags.quiet,
          emoji: flags.noEmoji !== true,
        },
      },
      { logger, userError }
    );
    if (result !== undefined) {
      logger.warn('publishEndedWithErrors');
      this.log(result);

      return;
    }

    logger.success('publishSuccessful', documentType);
    let transition = true;
    if (flags.force !== true) {
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
          ProfileId.fromId(flags.profileId, { userError }),
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
      await OutputStream.writeOnce(
        superJsonPath,
        JSON.stringify(superJson, undefined, 2),
        {
          force: flags.force,
        }
      );

      logger.info('updateSuperJson', superJsonPath);
    }
  }
}
