import { flags } from '@oclif/command';
import { parseProfileId } from '@superfaceai/parser';
import { grey, yellow } from 'chalk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { Command } from '../common/command.abstract';
import {
  constructProviderSettings,
  validateDocumentName,
} from '../common/document';
import { LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { generateSpecifiedProfiles, initSuperface } from '../logic/init';

const parseProfileIds = (
  input: string,
  options?: { warnCb?: LogCallback }
): string[] =>
  input
    .split(' ')
    .filter(p => p.trim() !== '')
    .filter(p => {
      if (parseProfileId(p).kind === 'error') {
        options?.warnCb?.('⬅ Invalid profile id');

        return false;
      }

      return true;
    });

const parseProviders = (
  input: string,
  options?: { warnCb?: LogCallback }
): string[] =>
  input
    .split(' ')
    .filter(i => i.trim() !== '')
    .filter(p => {
      if (!validateDocumentName(p)) {
        options?.warnCb?.('⬅ Invalid provider name');

        return false;
      }

      return true;
    });

async function promptProfiles(options?: {
  warnCb?: LogCallback;
}): Promise<string[]> {
  const response: { profiles: string } = await inquirer.prompt({
    name: 'profiles',
    message: 'Input space separated list of profile ids to initialize.',
    type: 'input',
    validate: (input: string): boolean => {
      // allow empty input
      if (input === '') {
        return true;
      }

      return parseProfileIds(input, options).length > 0;
    },
  });

  return parseProfileIds(response.profiles, options);
}

async function promptProviders(options?: {
  warnCb?: LogCallback;
}): Promise<string[]> {
  const response: { providers: string } = await inquirer.prompt({
    name: 'providers',
    message: 'Input space separated list of providers to initialize.',
    type: 'input',
    validate: (input: string): boolean => {
      // allow empty input
      if (input === '') {
        return true;
      }

      return parseProviders(input, options).length > 0;
    },
  });

  return parseProviders(response.providers, options);
}

export default class Init extends Command {
  static description = 'Initializes superface local folder structure.';

  // hide the command from help
  static hidden = true;

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
    profiles: flags.string({
      multiple: true,
      description: 'Profile identifiers.',
      required: false,
    }),
    providers: flags.string({
      multiple: true,
      description: 'Provider names.',
      required: false,
    }),
    prompt: flags.boolean({
      char: 'p',
      description: 'When set to true, prompt will be executed.',
      default: false,
      required: false,
    }),
  };

  private logCallback? = (message: string) => this.log(grey(message));
  private warnCallback? = (message: string) => this.warn(yellow(message));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Init);
    const hints: Record<string, string> = {
      flags: 'You can use flags instead of prompt.',
      help: '`Use superface init --help` for more informations.',
      quietMode: 'You can also use this command in quiet mode with flag `-q`.',
      quiet: '',
    };
    //Warn user
    this.warn(
      yellow(
        'You are using a hidden command. This command is not intended for public consumption yet. It might be broken, hard to use or simply redundant. Tread with care.'
      )
    );

    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;

      hints.quiet = yellow('\nYou are in Quiet mode.\n');
    }

    if (flags.prompt) {
      this
        .log(`This command will walk you through initializing superface folder structure ( mainly super.json structure ).
If no value is specified, the default will be taken in place ( empty super.json ).

${hints.flags} ${hints.help}
${hints.quietMode}
${hints.quiet}`);
    }

    let profiles = flags.profiles;
    let providers = flags.providers;

    if (flags.prompt) {
      if (!flags.profiles || flags.profiles.length === 0) {
        profiles = await promptProfiles({ warnCb: this.warnCallback });
      }

      if (!flags.providers || flags.providers.length === 0) {
        providers = await promptProviders({ warnCb: this.warnCallback });
      }
    } else {
      profiles ??= [];
      providers ??= [];
    }

    const path = args.name ? joinPath('.', args.name) : '.';

    const superJson = await initSuperface(
      path,
      {
        providers: constructProviderSettings(providers),
      },
      {
        logCb: this.logCallback,
        warnCb: this.warnCallback,
      }
    );

    if (profiles.length > 0) {
      await generateSpecifiedProfiles(
        path,
        superJson,
        profiles,
        this.logCallback
      );
      await OutputStream.writeOnce(superJson.path, superJson.stringified);
    }
  }
}
