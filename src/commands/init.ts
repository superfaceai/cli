import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/ast';
import { parseProfileId } from '@superfaceai/parser';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { Command, Flags } from '../common/command.abstract';
import { constructProviderSettings } from '../common/document';
import { UserError } from '../common/error';
import { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { generateSpecifiedProfiles, initSuperface } from '../logic/init';

const parseProfileIds = (input: string, logger: ILogger): string[] => {
  return input
    .split(' ')
    .filter(p => p.trim() !== '')
    .filter(p => {
      if (parseProfileId(p).kind === 'error') {
        logger.warn('invalidProfileId', p);

        return false;
      }

      return true;
    });
};

const parseProviders = (input: string, logger: ILogger): string[] =>
  input
    .split(' ')
    .filter(i => i.trim() !== '')
    .filter(p => {
      if (!isValidProviderName(p)) {
        logger.warn('invalidProviderName');

        return false;
      }

      return true;
    });

async function promptProfiles(logger: ILogger): Promise<string[]> {
  const response: { profiles: string } = await inquirer.prompt({
    name: 'profiles',
    message: 'Input space separated list of profile ids to initialize.',
    type: 'input',
    validate: (input: string): boolean => {
      // allow empty input
      if (input === '') {
        return true;
      }

      return parseProfileIds(input, logger).length > 0;
    },
  });

  return parseProfileIds(response.profiles, logger);
}

async function promptProviders(logger: ILogger): Promise<string[]> {
  const response: { providers: string } = await inquirer.prompt({
    name: 'providers',
    message: 'Input space separated list of providers to initialize.',
    type: 'input',
    validate: (input: string): boolean => {
      // allow empty input
      if (input === '') {
        return true;
      }

      return parseProviders(input, logger).length > 0;
    },
  });

  return parseProviders(response.providers, logger);
}

export default class Init extends Command {
  static description = 'Initializes superface local folder structure.';

  static examples = [
    'superface init',
    'superface init foo',
    'superface init foo --providers bar twilio',
    'superface init foo --profiles my-profile@1.1.0 another-profile@2.0 --providers osm gmaps',
  ];

  static args = [
    {
      name: 'name',
      description: 'Name of parent directory.',
      required: false,
    },
  ];

  static flags = {
    ...Command.flags,
    profiles: oclifFlags.string({
      multiple: true,
      description: 'Profile identifiers.',
      required: false,
    }),
    providers: oclifFlags.string({
      multiple: true,
      description: 'Provider names.',
      required: false,
    }),
    prompt: oclifFlags.boolean({
      char: 'p',
      description: 'When set to true, prompt will be executed.',
      default: false,
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags, args } = this.parse(Init);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
      args,
    });
  }

  async execute({
    logger,
    userError,
    flags,
    args,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Init.flags>;
    args: { name?: string };
  }): Promise<void> {
    const hints: Record<string, string> = {
      flags: 'You can use flags instead of prompt.',
      help: '`Use superface init --help` for more informations.',
      quietMode: 'You can also use this command in quiet mode with flag `-q`.',
      quiet: '',
    };

    if (flags.prompt) {
      logger.info(
        'initPrompt',
        hints.flags,
        hints.help,
        hints.quiet,
        hints.quietMode
      );
    }

    let profiles = flags.profiles;
    let providers = flags.providers;

    if (flags.prompt) {
      if (!flags.profiles || flags.profiles.length === 0) {
        profiles = await promptProfiles(logger);
      }

      if (!flags.providers || flags.providers.length === 0) {
        providers = await promptProviders(logger);
      }
    } else {
      profiles ??= [];
      providers ??= [];
    }

    const path = args.name ? joinPath('.', args.name) : '.';

    const superJson = await initSuperface(
      {
        appPath: path,
        initialDocument: {
          providers: constructProviderSettings(providers),
        },
      },
      { logger }
    );

    if (profiles.length > 0) {
      await generateSpecifiedProfiles(
        { path, superJson, profileIds: profiles },
        { logger, userError }
      );
      await OutputStream.writeOnce(superJson.path, superJson.stringified);
    }
  }
}
