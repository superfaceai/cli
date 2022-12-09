import { flags as oclifFlags } from '@oclif/command';
import { normalizeSuperJsonDocument } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';

import type { ILogger } from '../../common';
import { loadSuperJson } from '../../common';
import type { Flags } from '../../common/command.abstract';
import { Command } from '../../common/command.abstract';
import type { UserError } from '../../common/error';
import { ProfileId } from '../../common/profile';
import { prepareMockMapTest } from '../../logic/prepare/mock-map-test';

export class MockMapTest extends Command {
  public static strict = true;

  public static description =
    'Prepares test for mock provider map on a local filesystem. Created test expects success result example from profile file. Before running this command you should have prepared mock provider map (run sf prepare:mock-map).';

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
    '$ superface prepare:mock-map-test starwars/character-information --force',
    '$ superface prepare:mock-map-test starwars/character-information -s 3',
    '$ superface prepare:mock-map-test starwars/character-information --station',
  ];

  public async run(): Promise<void> {
    const { args, flags } = this.parse(MockMapTest);
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
    flags: Flags<typeof MockMapTest.flags>;
    args: { profileId?: string };
  }): Promise<void> {
    // Check inputs
    if (args.profileId === undefined) {
      throw userError(`Missing profile id`, 1);
    }

    const parsedProfileId = parseDocumentId(args.profileId);
    if (parsedProfileId.kind == 'error') {
      throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
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
    if (normalized.profiles[args.profileId] === undefined) {
      throw userError(
        `Unable to prepare, profile: "${args.profileId}" not found in super.json`,
        1
      );
    }

    await prepareMockMapTest(
      {
        profile: ProfileId.fromId(args.profileId, { userError }),
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
