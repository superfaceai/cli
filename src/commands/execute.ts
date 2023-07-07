import type { ILogger } from '../common';
import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { buildMapPath, buildRunFilePath } from '../common/file-structure';
import { exists } from '../common/io';
import { ProfileId } from '../common/profile';
import { SupportedLanguages } from '../logic';
import { execute } from '../logic/execution';
import { resolveLanguage, resolveProfileSource } from './map';
import { resolveProviderJson } from './new';

export default class Execute extends Command {
  // TODO: add description
  public static description =
    'Run the created integration. Commands `prepare`, `new` and `map` must be run before this command. This command will execute integration using Node.js (more runners coming soon)';

  public static examples = [
    'superface execute resend communication/send-email',
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
      // TODO: add language support
      name: 'language',
      description: 'Language which will use generated code. Default is `js`.',
      // TODO: this will be required when we support more languages
      required: false,
      default: 'js',
      options: Object.keys(SupportedLanguages),
      // Hidden because we support only js for now
      hidden: true,
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

    const resolvedLanguage = resolveLanguage(language, { userError });

    const providerJson = await resolveProviderJson(providerName, { userError });

    const profile = await resolveProfileSource(profileId, { userError });

    const parsedProfileId = ProfileId.fromScopeName(
      profile.scope,
      profile.name
    ).id;

    // Check that map exists
    if (
      !(await exists(
        buildMapPath({
          profileName: profile.name,
          providerName: providerJson.name,
          profileScope: profile.scope,
        })
      ))
    ) {
      throw userError(
        `Map for profile ${parsedProfileId} and provider ${providerJson.name} does not exist.`,
        1
      );
    }

    // Check that runfile exists
    const runfile = buildRunFilePath({
      profileName: profile.name,
      providerName: providerJson.name,
      profileScope: profile.scope,
      language: resolvedLanguage,
    });
    if (!(await exists(runfile))) {
      throw userError(
        `Runfile for profile ${parsedProfileId} and provider ${providerJson.name} does not exist.`,
        1
      );
    }

    await execute(runfile, resolvedLanguage, { logger, userError });
  }
}
