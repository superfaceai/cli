import type { ProfileDocumentNode, ProviderJson } from '@superfaceai/ast';
import {
  AssertionError,
  assertProviderJson,
  isValidProviderName,
} from '@superfaceai/ast';
import { parseDocumentId, parseProfile, Source } from '@superfaceai/parser';

import type { ILogger } from '../common';
import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import {
  buildMapPath,
  buildProfilePath,
  buildProviderPath,
  buildRunFilePath,
} from '../common/file-structure';
import { exists, readFile } from '../common/io';
import { execute } from '../logic/execution';

export default class Execute extends Command {
  // TODO: add description
  public static description =
    'This commands executes created integration. Commands `prepare`, `new` and `map` must be run before this command.';

  public static examples = [
    'superface execute <provider-name> <optional-profile-scope>.<profile-name> <optional-language>',
  ];

  public static args = [
    {
      name: 'providerName',
      description: 'Name of provider.',
      required: true,
    },
    {
      name: 'profileId',
      description: 'Id of profile, eg: starwars.character-information',
      required: true,
    },
    {
      name: 'language',
      description: 'Language of generated integration. Default is JS.',
      required: false,
      default: 'JS',
    },
  ];

  public static flags = {
    ...Command.flags,
  };

  public async run(): Promise<void> {
    const { flags, args } = this.parse(Execute);
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
    // flags,
    args,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Execute.flags>;
    args: { providerName?: string; profileId?: string; language?: string };
  }): Promise<void> {
    const { providerName, profileId, language } = args;

    // TODO: resuse check from New command
    // Check provider name
    if (providerName === undefined) {
      throw userError(
        'Missing provider name. Please provide it as first argument.',
        1
      );
    }

    if (!isValidProviderName(providerName)) {
      throw userError('Invalid provider name', 1);
    }

    if (!(await exists(buildProviderPath(providerName)))) {
      throw userError(
        `Provider ${providerName} does not exist. Make sure to run "sf prepare" before running this command.`,
        1
      );
    }

    const providerJsonFile = await readFile(
      buildProviderPath(providerName),
      'utf-8'
    );

    let providerJson: ProviderJson;
    try {
      providerJson = JSON.parse(providerJsonFile) as ProviderJson;
    } catch (e) {
      throw userError(`Invalid provider.json file.`, 1);
    }

    try {
      assertProviderJson(providerJson);
    } catch (e) {
      if (e instanceof AssertionError) {
        throw userError(`Invalid provider.json file. ${e.message}`, 1);
      }
      throw userError(`Invalid provider.json file.`, 1);
    }

    if (providerName !== providerJson.name) {
      throw userError(
        `Provider name in provider.json file does not match provider name in command.`,
        1
      );
    }

    // Check profile name
    if (profileId === undefined) {
      throw userError(
        'Missing profile id. Please provide it as first argument.',
        1
      );
    }

    // TODO: move provide Id handling to common?
    const parsedProfileId = parseDocumentId(profileId.replace(/\./, '/'));
    if (parsedProfileId.kind == 'error') {
      throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
    }

    if (!(await exists(buildProfilePath(profileId)))) {
      throw userError(`Profile ${profileId} does not exist.`, 1);
    }

    const profileSource = await readFile(buildProfilePath(profileId), 'utf-8');

    // TODO: this might be problematic - not matchiing parser versions between CLI and Server
    let profileAst: ProfileDocumentNode;
    try {
      profileAst = parseProfile(new Source(profileSource, profileId));
    } catch (e) {
      throw userError(
        `Invalid profile ${profileId}: ${JSON.stringify(e, undefined, 2)}`,
        1
      );
    }

    // TODO: revisit name check
    if (profileAst.header.name !== parsedProfileId.value.middle[0]) {
      throw userError(
        `Profile name in profile file does not match profile name in command.`,
        1
      );
    }

    if (profileAst.header.scope !== parsedProfileId.value.scope) {
      throw userError(
        `Profile scope in profile file does not match profile scope in command.`,
        1
      );
    }

    // Check language
    if (language !== undefined && language !== 'JS') {
      throw userError(
        `Language ${language} is not supported. Currently only JS is supported.`,
        1
      );
    }

    // Check that map exists
    if (!(await exists(buildMapPath(profileId, providerName)))) {
      throw userError(
        `Map for profile ${profileId} and provider ${providerName} does not exist.`,
        1
      );
    }

    // Check that runfile exists
    const runfile = buildRunFilePath(profileId, providerName, language ?? 'JS');
    if (!(await exists(runfile))) {
      throw userError(
        `Runfile for profile ${profileId} and provider ${providerName} does not exist.`,
        1
      );
    }

    await execute(runfile, language ?? 'JS', { logger, userError });
  }
}
