import type { ILogger } from '../common';
import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { buildMapPath, buildRunFilePath } from '../common/file-structure';
import { exists } from '../common/io';
import { execute } from '../logic/execution';
import { resolveProfileSource } from './map';
import { resolveProviderJson } from './new';

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
    const providerJson = await resolveProviderJson(providerName, { userError });

    await resolveProfileSource(profileId, { userError });

    // Check language
    if (language !== undefined && language !== 'JS') {
      throw userError(
        `Language ${language} is not supported. Currently only JS is supported.`,
        1
      );
    }

    // Check that map exists
    if (!(await exists(buildMapPath(profileId!, providerJson.name)))) {
      throw userError(
        `Map for profile ${profileId!} and provider ${providerJson.name} does not exist.`,
        1
      );
    }

    // Check that runfile exists
    const runfile = buildRunFilePath(
      profileId!,
      providerJson.name,
      language ?? 'JS'
    );
    if (!(await exists(runfile))) {
      throw userError(
        `Runfile for profile ${profileId!} and provider ${providerJson.name} does not exist.`,
        1
      );
    }

    await execute(runfile, language ?? 'JS', { logger, userError });
  }
}
