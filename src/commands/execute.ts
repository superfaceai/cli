import type { ILogger } from '../common';
import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import {
  buildMapPath,
  buildRunFilePath,
  isInsideSuperfaceDir,
} from '../common/file-structure';
import { SuperfaceClient } from '../common/http';
import { exists } from '../common/io';
import { ProfileId } from '../common/profile';
import { resolveProviderJson } from '../common/provider';
import { UX } from '../common/ux';
import { SupportedLanguages } from '../logic';
import { execute } from '../logic/execution';
import { resolveLanguage, resolveProfileSource } from './map';

export default class Execute extends Command {
  // TODO: add description
  public static description =
    'Run the created integration in superface directory. Commands `prepare`, `new` and `map` must be run before this command. You can switch runner language via `language` flag (`js` by default).';

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
      name: 'language',
      description: 'Language of the application code runner. Default is `js`.',
      required: false,
      default: SupportedLanguages.JS,
      options: Object.values(SupportedLanguages),
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
    const ux = UX.create();
    const { providerName, profileId, language } = args;

    if (providerName === undefined || profileId === undefined) {
      throw userError(
        'Missing provider name or profile ID. Usage: `superface execute PROVIDERNAME PROFILEID`',
        1
      );
    }

    if (!isInsideSuperfaceDir()) {
      throw userError('Command must be run inside superface directory', 1);
    }
    const resolvedLanguage = resolveLanguage(language, { userError });

    ux.start('Loading provider definition');
    const resolvedProviderJson = await resolveProviderJson(providerName, {
      userError,
      client: SuperfaceClient.getClient(),
    });

    if (resolvedProviderJson.source === 'local') {
      ux.succeed(
        `Input arguments checked. Provider JSON resolved from local file ${resolvedProviderJson.path}`
      );
    } else {
      ux.succeed(
        `Input arguments checked. Provider JSON resolved from Superface server`
      );
    }

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
          providerName: resolvedProviderJson.providerJson.name,
          profileScope: profile.scope,
        })
      ))
    ) {
      throw userError(
        `Map for profile ${parsedProfileId} and provider ${resolvedProviderJson.providerJson.name} does not exist.`,
        1
      );
    }

    // Check that runfile exists
    const runfile = buildRunFilePath({
      profileName: profile.name,
      providerName: resolvedProviderJson.providerJson.name,
      profileScope: profile.scope,
      language: resolvedLanguage,
    });
    if (!(await exists(runfile))) {
      throw userError(
        `Runfile for profile ${parsedProfileId} and provider ${resolvedProviderJson.providerJson.name} does not exist.`,
        1
      );
    }

    await execute(runfile, resolvedLanguage, { logger, userError });
  }
}
