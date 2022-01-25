import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import { ILogger, META_FILE } from '../common';
import { Command, Flags } from '../common/command.abstract';
import { UserError } from '../common/error';
import { ProfileId } from '../common/profile';
import { detectSuperJson } from '../logic/install';
import { prepareTest } from '../logic/prepare-test';

export default class PrepareTest extends Command {
  static strict = false;

  static description =
    'Prepares test file for specified profile and provider. Examples in profile are used as an input.';

  static args = [];

  static flags = {
    ...Command.flags,
    //Inputs
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
    path: oclifFlags.string({
      description: 'Path to test file. Default is [cwd]/[scope]/[name]',
      required: false,
    }),
    fileName: oclifFlags.string({
      description: 'Name of test file. Default is [provider.test.ts]',
      required: false,
    }),
  };

  static examples = [
    '$ superface prepare-test --profileId starwars/character-information --providerName swapi',
    '$ superface prepare-test --profileId starwars/character-information --providerName swapi --path my/path',
    '$ superface prepare-test --profileId starwars/character-information --providerName swapi --fileName custom.ts',
    '$ superface prepare-test --profileId starwars/character-information --providerName swapi -q',
  ];

  async run(): Promise<void> {
    const { argv, flags } = this.parse(PrepareTest);
    await super.initialize(flags);

    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
      argv,
    });
  }

  async execute({
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

    if (flags.scan && (typeof flags.scan !== 'number' || flags.scan > 5)) {
      throw userError(
        '--scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }

    //Load super json
    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (!superPath) {
      throw userError('❌ Unable to check, super.json not found', 1);
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

    //Check super.json
    if (!superJson.normalized.profiles[flags.profileId]) {
      throw userError(
        `❌ Unable to check, profile: "${flags.profileId}" not found in super.json`,
        1
      );
    }
    if (
      !superJson.normalized.profiles[flags.profileId].providers[
        flags.providerName
      ]
    ) {
      throw userError(
        `❌ Unable to check, provider: "${flags.providerName}" not found in profile: "${flags.profileId}" in super.json`,
        1
      );
    }
    if (!superJson.normalized.providers[flags.providerName]) {
      throw userError(
        `❌ Unable to check, provider: "${flags.providerName}" not found in super.json`,
        1
      );
    }

    await prepareTest(
      {
        superJson,
        profile: ProfileId.fromId(flags.profileId, { userError }),
        provider: flags.providerName,
        path: flags.path,
        fileName: flags.fileName,
        version: undefined,
      },
      { logger }
    );
  }
}
