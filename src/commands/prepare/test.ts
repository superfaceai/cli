import { flags as oclifFlags } from '@oclif/command';
import {
  loadSuperJson,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import type { ILogger } from '../../common';
import { META_FILE, validateArguments } from '../../common';
import type { Flags } from '../../common/command.abstract';
import { Command } from '../../common/command.abstract';
import type { UserError } from '../../common/error';
import { ProfileId } from '../../common/profile';
import { detectSuperJson } from '../../logic/install';
import { prepareTest } from '../../logic/prepare/test';

export default class PrepareTest extends Command {
  public static strict = false;

  public static description =
    'Prepares test file for specified profile and provider. Examples in profile are used as an input.';

  public static args = [
    {
      name: 'profileId',
      description: 'Profile Id in format [scope](optional)/[name]',
      required: true,
    },
    { name: 'providerName', description: 'Name of provider', required: true },
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
    '$ superface prepare:test starwars/character-information swapi',
    '$ superface prepare:test starwars/character-information swapi --station',
    '$ superface prepare:test starwars/character-information swapi --force',
    '$ superface prepare:test starwars/character-information swapi -q',
  ];

  public async run(): Promise<void> {
    const { args, flags } = this.parse(PrepareTest);
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
    flags: Flags<typeof PrepareTest.flags>;
    args: { providerName?: string; profileId?: string };
  }): Promise<void> {
    // Check inputs
    const { profileId, providerName } = validateArguments(
      args.profileId,
      args.providerName,
      { userError }
    );

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
      throw userError('❌ Unable to prepare test, super.json not found', 1);
    }
    const superJsonPath = joinPath(superPath, META_FILE);
    const loadedResult = await loadSuperJson(superJsonPath, NodeFileSystem);
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(
          `❌ Unable to load super.json: ${err.formatShort()}`,
          1
        );
      }
    );

    // Check super.json
    const normalized = normalizeSuperJsonDocument(superJson);

    if (normalized.profiles[profileId] === undefined) {
      throw userError(
        `❌ Unable to prepare test, profile: "${profileId}" not found in super.json`,
        1
      );
    }
    if (normalized.providers[providerName] === undefined) {
      throw userError(
        `❌ Unable to prepare test, provider: "${providerName}" not found in super.json`,
        1
      );
    }
    // TODO: only for local files?

    await prepareTest(
      {
        superJsonPath,
        superJson,
        profile: ProfileId.fromId(profileId, { userError }),
        provider: providerName,
        options: {
          force: flags.force,
          station: flags.station,
        },
        version: undefined,
      },
      { logger }
    );
  }
}
