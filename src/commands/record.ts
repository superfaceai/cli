import { flags as oclifFlags } from '@oclif/command';
import { normalizeSuperJsonDocument } from '@superfaceai/one-sdk';

import type { ILogger } from '../common';
import { loadSuperJson, validateArguments } from '../common';
import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { ProfileId } from '../common/profile';
import { record } from '../logic/record/record';

export class Record extends Command {
  public static strict = true;

  public static description =
    'Prepares map, based on profile and provider on a local filesystem. Created file contains prepared structure with information from profile and provider files. Before running this command you should have prepared profile (run sf prepare:profile) and provider (run sf prepare:provider)';

  public static args = [
    {
      name: 'profileId',
      description: 'Profile Id in format [scope](optional)/[name]',
      required: true,
    },
    { name: 'providerName', description: 'Name of provider', required: true },
    { name: 'useCaseName', description: 'Name of use case', required: true },
  ];

  public static flags = {
    ...Command.flags,
    // Inputs
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
        'When set to true, command will create map in folder structure of Superface station',
    }),
  };

  public static examples = [
    '$ superface prepare:map starwars/character-information swapi --force',
    '$ superface prepare:map starwars/character-information swapi -s 3',
    '$ superface prepare:map starwars/character-information swapi --station',
  ];

  public async run(): Promise<void> {
    const { args, flags } = this.parse(Record);
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
    flags: Flags<typeof Record.flags>;
    args: { providerName?: string; profileId?: string; useCaseName?: string };
  }): Promise<void> {
    // Check inputs
    const { profileId, providerName } = validateArguments(
      args.profileId,
      args.providerName,
      { userError }
    );

    if (args.useCaseName === undefined) {
      throw userError(`Unable to prepare, use case name missing`, 1);
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
    const { superJson, superJsonPath } = await loadSuperJson({
      scan: flags.scan,
      userError,
    });

    const normalized = normalizeSuperJsonDocument(superJson);

    // Check super.json
    if (normalized.profiles[profileId] === undefined) {
      throw userError(
        `Unable to prepare, profile: "${profileId}" not found in super.json`,
        1
      );
    }

    if (normalized.providers[providerName] === undefined) {
      throw userError(
        `Unable to prepare, provider: "${providerName}" not found in super.json`,
        1
      );
    }

    await record(
      {
        profile: ProfileId.fromId(profileId, { userError }),
        provider: providerName,
        map: {},
        superJson: normalized,
        superJsonPath,
        useCaseName: args.useCaseName,
      },
      {
        userError,
        logger,
      }
    );
  }
}
