import { Command, flags } from '@oclif/command';
import { parseProfileId } from '@superfaceai/parser';
import { grey } from 'chalk';
import inquirer from 'inquirer';

import { validateDocumentName } from '../common/document';
import {
  constructProfileSettings,
  constructProviderSettings,
  generateSpecifiedProfiles,
  initSuperface,
} from '../logic/init';

export default class Init extends Command {
  static description = 'Initializes superface local folder structure.';

  static examples = [
    'superface init',
    'superface init ./some-dir',
    'superface init ./some-dir --providers osm gmaps',
    'superface init ./some-dir --profiles my-profile@1.1.0 another-profile@2.0 --providers osm gmaps',
  ];

  static args = [
    {
      name: 'path',
      description: 'Path where to initialize folder structure.',
      required: false,
    },
  ];

  static flags = {
    quiet: flags.boolean({
      char: 'q',
      description:
        'When set to true, disables the shell echo output of init actions.',
      default: false,
    }),
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
    force: flags.boolean({
      char: 'f',
      description: 'When set to true, default values will be specified.',
      default: false,
    }),
    help: flags.help({ char: 'h' }),
  };

  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Init);

    this
      .log(`This command will walk you through initializing superface folder structure ( mainly super.json structure ). 
If no value is specified, the default will be taken in place ( empty super.json ).

You can use flags instead of prompt. \`Use superface init --help\` for more informations.
You can also use this command in quiet mode with flag \`-q\`.
`);

    if (flags.quiet) {
      this.logCallback = undefined;
    }

    let profiles = flags.profiles;
    let providers = flags.providers;

    if (!flags.force) {
      // initialize profiles
      if (!flags.profiles || flags.profiles.length === 0) {
        const response: { profiles: string } = await inquirer.prompt({
          name: 'profiles',
          message: 'Input space separated list of profile ids to initialize.',
          type: 'input',
          validate: (input: string): boolean => {
            // allow empty input
            if (input === '') {
              return true;
            }

            const profiles = parseProfileIds(input);

            return profiles.length > 0;
          },
        });
        profiles = parseProfileIds(response.profiles);
      }

      // initialize providers
      if (!flags.providers || flags.providers.length === 0) {
        const response: { providers: string } = await inquirer.prompt({
          name: 'providers',
          message: 'Input space separated list of providers to initialize.',
          type: 'input',
          validate: (input: string): boolean => {
            // allow empty input
            if (input === '') {
              return true;
            }

            const providers = parseProviders(input);

            return providers.length > 0;
          },
        });
        providers = parseProviders(response.providers);
      }
    } else {
      profiles ??= [];
      providers ??= [];
    }

    let path = './';
    if (typeof args.path === 'string') {
      path = args.path;
    }

    await initSuperface(
      path,
      constructProfileSettings(profiles),
      constructProviderSettings(providers),
      {
        logCb: this.logCallback,
      }
    );

    if (profiles.length > 0) {
      await generateSpecifiedProfiles(path, profiles, this.logCallback);
    }
  }
}

export const parseProfileIds = (input: string): string[] =>
  input
    .split(' ')
    .filter(p => p.trim() !== '')
    .filter(p => parseProfileId(p).kind !== 'error');

export const parseProviders = (input: string): string[] =>
  input
    .split(' ')
    .filter(i => i.trim() !== '')
    .filter(validateDocumentName);
