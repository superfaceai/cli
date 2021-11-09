import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/ast';
import { parseProfileId } from '@superfaceai/parser';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { Command } from '../common/command.abstract';
import { constructProviderSettings } from '../common/document';
import { Logger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { generateSpecifiedProfiles, initSuperface } from '../logic/init';

const parseProfileIds = (
  input: string
): string[] => {
  return input
    .split(' ')
    .filter(p => p.trim() !== '')
    .filter(p => {
      if (parseProfileId(p).kind === 'error') {
        Logger.warn('⬅ Invalid profile id');
        return false;
      }

      return true;
    });
};

const parseProviders = (
  input: string
): string[] =>
  input
    .split(' ')
    .filter(i => i.trim() !== '')
    .filter(p => {
      if (!isValidProviderName(p)) {
        Logger.warn('⬅ Invalid provider name');

        return false;
      }

      return true;
    });

async function promptProfiles(): Promise<string[]> {
  const response: { profiles: string } = await inquirer.prompt({
    name: 'profiles',
    message: 'Input space separated list of profile ids to initialize.',
    type: 'input',
    validate: (input: string): boolean => {
      // allow empty input
      if (input === '') {
        return true;
      }

      return parseProfileIds(input).length > 0;
    },
  });

  return parseProfileIds(response.profiles);
}

async function promptProviders(): Promise<string[]> {
  const response: { providers: string } = await inquirer.prompt({
    name: 'providers',
    message: 'Input space separated list of providers to initialize.',
    type: 'input',
    validate: (input: string): boolean => {
      // allow empty input
      if (input === '') {
        return true;
      }

      return parseProviders(input).length > 0;
    },
  });

  return parseProviders(response.providers);
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
    const { args, flags } = this.parse(Init);
    const hints: Record<string, string> = {
      flags: 'You can use flags instead of prompt.',
      help: '`Use superface init --help` for more informations.',
      quietMode: 'You can also use this command in quiet mode with flag `-q`.',
      quiet: '',
    };

    this.setUpLogger(flags.quiet);

    if (flags.prompt) {
      Logger.info(`This command will walk you through initializing superface folder structure ( mainly super.json structure ).
      If no value is specified, the default will be taken in place ( empty super.json ).
      
      ${hints.flags} ${hints.help}
      ${hints.quietMode}
      ${hints.quiet}`);
    }

    let profiles = flags.profiles;
    let providers = flags.providers;

    if (flags.prompt) {
      if (!flags.profiles || flags.profiles.length === 0) {
        profiles = await promptProfiles();
      }

      if (!flags.providers || flags.providers.length === 0) {
        providers = await promptProviders();
      }
    } else {
      profiles ??= [];
      providers ??= [];
    }

    const path = args.name ? joinPath('.', args.name) : '.';

    const superJson = await initSuperface(path, {
      providers: constructProviderSettings(providers),
    });

    if (profiles.length > 0) {
      await generateSpecifiedProfiles(path, superJson, profiles);
      await OutputStream.writeOnce(superJson.path, superJson.stringified);
    }
  }
}
