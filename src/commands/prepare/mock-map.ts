import { flags as oclifFlags } from '@oclif/command';
import { normalizeSuperJsonDocument } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';

import type { ILogger } from '../../common';
import { loadSuperJson } from '../../common';
import type { Flags } from '../../common/command.abstract';
import { Command } from '../../common/command.abstract';
import type { UserError } from '../../common/error';
import { ProfileId } from '../../common/profile';
import { prepareMockMap } from '../../logic/prepare/mock-map';

export class MockMap extends Command {
  public static strict = true;

  public static description =
    'Prepares map for mock provider on a local filesystem. Created map always returns success result example from profile file. Before running this command you should have prepared profile file (run sf prepare:profile).';

  public static flags = {
    ...Command.flags,
    // Inputs
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope](optional)/[name]',
      required: true,
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
        'When set to true, command will create map in folder structure of Superface station',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = this.parse(MockMap);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
    });
  }

  public async execute({
    logger,
    userError,
    flags,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof MockMap.flags>;
  }): Promise<void> {
    // Check inputs
    const parsedProfileId = parseDocumentId(flags.profileId);
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
    if (normalized.profiles[flags.profileId] === undefined) {
      throw userError(
        `Unable to prepare, profile: "${flags.profileId}" not found in super.json`,
        1
      );
    }

    await prepareMockMap(
      {
        id: {
          profile: ProfileId.fromId(flags.profileId, { userError }),
        },
        superJson,
        superJsonPath,
        options: {
          force: flags.force,
          station: flags.station,
        },
      },
      {
        userError,
        logger,
      }
    );
  }
}
