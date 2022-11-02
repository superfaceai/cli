import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/ast';
import {
  loadSuperJson,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import type { ILogger } from '../../common';
import { META_FILE } from '../../common';
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

  public static flags = {
    ...Command.flags,
    // Inputs
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope/](optional)[name]',
      required: true,
    }),
    providerName: oclifFlags.string({
      description: 'Name of provider.',
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

  public static examples = [
    '$ superface prepare-test --profileId starwars/character-information --providerName swapi',
    '$ superface prepare-test --profileId starwars/character-information --providerName swapi --station',
    '$ superface prepare-test --profileId starwars/character-information --providerName swapi --force',
    '$ superface prepare-test --profileId starwars/character-information --providerName swapi -q',
  ];

  public async run(): Promise<void> {
    const { argv, flags } = this.parse(PrepareTest);
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
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof PrepareTest.flags>;
    argv: string[];
  }): Promise<void> {
    // Check inputs
    const parsedProfileId = parseDocumentId(flags.profileId);
    if (parsedProfileId.kind == 'error') {
      throw userError(`❌ Invalid profile id: ${parsedProfileId.message}`, 1);
    }

    if (!isValidProviderName(flags.providerName)) {
      throw userError(`❌ Invalid provider name: "${flags.providerName}"`, 1);
    }
    if (!flags.profileId) {
      throw userError(
        '❌ --profileId must be specified when using --providerName',
        1
      );
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
      throw userError('❌ Unable to check, super.json not found', 1);
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

    if (normalized.profiles[flags.profileId] === undefined) {
      throw userError(
        `❌ Unable to prepare test, profile: "${flags.profileId}" not found in super.json`,
        1
      );
    }
    if (
      normalized.profiles[flags.profileId].providers[flags.providerName] ===
      undefined
    ) {
      throw userError(
        `❌ Unable to prepare, provider: "${flags.providerName}" not found in profile: "${flags.profileId}" in super.json`,
        1
      );
    }
    if (normalized.providers[flags.providerName] === undefined) {
      throw userError(
        `❌ Unable to prepare, provider: "${flags.providerName}" not found in super.json`,
        1
      );
    }

    await prepareTest(
      {
        superJsonPath,
        superJson,
        profile: ProfileId.fromId(flags.profileId, { userError }),
        provider: flags.providerName,
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
