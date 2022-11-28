import { flags as oclifFlags } from '@oclif/command';
import { isValidIdentifier } from '@superfaceai/ast';
import { loadSuperJson, NodeFileSystem } from '@superfaceai/one-sdk';
import { parseProfileId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import type { ILogger } from '../../common';
import {
  composeUsecaseName,
  DEFAULT_PROFILE_VERSION_STR,
  META_FILE,
} from '../../common';
import type { Flags } from '../../common/command.abstract';
import { Command } from '../../common/command.abstract';
import type { UserError } from '../../common/error';
import { ProfileId } from '../../common/profile';
import { detectSuperJson } from '../../logic/install';
import { prepareProfile } from '../../logic/prepare';

export class Profile extends Command {
  public static strict = true;

  public static description =
    'Prepares profile file on local filesystem and links it to super.json.';

  public static args = [
    {
      name: 'profileId',
      description: 'Profile Id in format [scope](optional)/[name]',
      required: true,
    },
  ];

  public static flags = {
    ...Command.flags,
    // Inputs
    version: oclifFlags.string({
      char: 'v',
      default: DEFAULT_PROFILE_VERSION_STR,
      description: 'Version of a profile',
    }),
    usecase: oclifFlags.string({
      char: 'u',
      multiple: true,
      description: 'Usecases that profile contains',
    }),
    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
    force: oclifFlags.boolean({
      char: 'f',
      description:
        'When set to true and when profile exists in local filesystem, overwrites them.',
      default: false,
    }),
    station: oclifFlags.boolean({
      default: false,
      description:
        'When set to true, command will create profile in folder structure of Superface station',
    }),
  };

  public static examples = [
    '$ superface prepare:profile starwars/character-information --force',
    '$ superface prepare:profile starwars/character-information -s 3',
    '$ superface prepare:profile starwars/character-information --station',
  ];

  public async run(): Promise<void> {
    const { args, flags } = this.parse(Profile);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
      args,
    });
  }

  public async execute({
    logger,
    userError,
    flags,
    args,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Profile.flags>;
    args: { profileId?: string };
  }): Promise<void> {
    // Check inputs
    if (args.profileId == undefined) {
      throw userError('--profileId must be specified', 1);
    }

    const parsedProfileId = parseProfileId(
      `${args.profileId}@${flags.version}`
    );
    if (parsedProfileId.kind === 'error') {
      throw userError(parsedProfileId.message, 1);
    }

    // compose document structure from the result
    const name = parsedProfileId.value.name;

    if (
      flags.scan !== undefined &&
      (typeof flags.scan !== 'number' || flags.scan > 5)
    ) {
      throw userError(
        '--scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }

    const usecases =
      flags.usecase !== undefined && flags.usecase.length > 0
        ? flags.usecase
        : [composeUsecaseName(name)];
    for (const usecase of usecases) {
      if (!isValidIdentifier(usecase)) {
        throw userError(`Invalid usecase name: ${usecase}`, 1);
      }
    }
    const superPath: string | undefined = await detectSuperJson(
      process.cwd(),
      flags.scan
    );
    if (superPath === undefined) {
      throw userError('Unable to prepare profile, super.json not found', 1);
    }
    // Load super json
    const superJsonPath = joinPath(superPath, META_FILE);
    const loadedResult = await loadSuperJson(superJsonPath, NodeFileSystem);
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err.formatShort()}`, 1);
      }
    );

    await prepareProfile(
      {
        id: {
          profile: ProfileId.fromId(args.profileId, { userError }),
          version: flags.version,
        },
        usecaseNames: usecases,
        superJson,
        superJsonPath,
        options: {
          force: flags.force,
          station: flags.station,
        },
      },
      {
        logger,
      }
    );
  }
}
