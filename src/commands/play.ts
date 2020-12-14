import { Command, flags } from '@oclif/command';
import { grey } from 'chalk';
import inquirer from 'inquirer';
import FileTreeSelectionPrompt from 'inquirer-file-tree-selection-prompt';
import * as nodePath from 'path';

import { validateDocumentName } from '../common/document';
import { developerError, userError } from '../common/error';
import { skipFileFlag, SkipFileType } from '../common/flags';
import { exists } from '../common/io';
import {
  cleanPlayground,
  detectPlayground,
  executePlayground,
  initializePlayground,
} from '../logic/playground';

inquirer.registerPrompt('file-tree-selection', FileTreeSelectionPrompt);

type ActionType = 'initialize' | 'execute' | 'clean';
function isActionType(input: unknown): input is ActionType {
  return (
    typeof input === 'string' &&
    (input === 'initialize' || input === 'execute' || input === 'clean')
  );
}

export default class Play extends Command {
  static description = `Manages and executes interactive playgrounds. Missing arguments are interactively prompted.
Playground is a folder F which contains a profile (\`F.supr\`), maps (\`F.*.suma\`) and glue scripts (\`F.*.ts\`) where \`*\` denotes provider name.
initialize: a playground is populated with an example profile, and a pair of a map and a glue script for each provider.
execute: the profile, and the selected pairs of a map and a glue script are compiled and the specified provider glue scripts are executed.
clean: the \`node_modules\` folder and compilation artifacts are cleaned.`;

  static examples = [
    'superface play',
    'superface play initialize PubHours --providers osm gmaps',
    'superface play execute PubHours --providers osm',
    'superface play clean PubHours',
  ];

  static args = [
    {
      name: 'action',
      description: 'Action to take.',
      required: false,
      options: ['initialize', 'execute', 'clean'],
    },
    {
      name: 'playground',
      description: 'Path to the playground to initialize or execute.',
      required: false,
    },
  ];

  static flags = {
    providers: flags.string({
      char: 'p',
      multiple: true,
      description: 'Providers to initialize or execute.',
    }),

    skip: skipFileFlag({
      description:
        'Controls the fallback skipping behavior of more specific skip flags.\nSee `--skip-npm`, `--skip-ast`, and `--skip-tsc` for more details.',
      default: 'never',
    }),
    'skip-npm': skipFileFlag({
      description:
        'Control skipping behavior of the npm install execution step.\n`exists` checks for the presence of `node_modules` directory.',
    }),
    'skip-ast': skipFileFlag({
      description:
        'Control skipping behavior of the superface ast compile execution step.\n`exists` checks for the presence of `<name>.<provider>.suma.ast.json` files.',
    }),
    'skip-tsc': skipFileFlag({
      description:
        'Control skipping behavior of the tsc compile execution step.\n`exists` checks for the presence of `<name>.<provider>.js files.',
    }),

    quiet: flags.boolean({
      char: 'q',
      description:
        'When set to true, disables the shell echo output of play actions.',
      default: false,
    }),

    help: flags.help({ char: 'h' }),
  };

  private logCallback?: (message: string) => void = m => this.log(grey(m));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Play);

    let action: unknown = args.action;
    if (action === undefined) {
      const response: { action: ActionType } = await inquirer.prompt({
        name: 'action',
        message: 'Select an action',
        type: 'list',
        choices: [
          {
            name: 'Initialize a new playground',
            value: 'initialize',
          },
          {
            name: 'Execute an existing playground',
            value: 'execute',
          },
          {
            name: 'Clean an existing playground',
            value: 'clean',
          },
        ],
      });
      action = response.action;
    }
    this.debug('Action:', action);
    if (!isActionType(action)) {
      throw developerError('Invalid action', 1);
    }

    if (flags.quiet === true) {
      this.logCallback = undefined;
    }

    if (action === 'initialize') {
      await this.runInitialize(args.playground, flags.providers);
    } else if (action === 'execute') {
      await this.runExecute(args.playground, flags.providers, {
        npm: flags['skip-npm'] ?? flags.skip,
        ast: flags['skip-ast'] ?? flags.skip,
        tsc: flags['skip-tsc'] ?? flags.skip,
      });
    } else if (action === 'clean') {
      await this.runClean(args.playground);
    }
  }

  // INITIALIZE //

  private async runInitialize(
    path: string | undefined,
    providers: string[] | undefined
  ): Promise<void> {
    if (path === undefined) {
      const response: { playground: string } = await inquirer.prompt({
        name: 'playground',
        message: `Path to playground to initialize`,
        type: 'input',
        validate: async (input: unknown): Promise<boolean | string> => {
          if (typeof input !== 'string') {
            throw developerError('unexpected argument type', 11);
          }

          if (input.trim().length === 0) {
            return 'The playground path must not be empty.';
          }

          const fileExists = await exists(input);
          if (fileExists) {
            return 'The playground path must not exist.';
          }

          const baseName = nodePath.basename(input);
          if (!validateDocumentName(baseName)) {
            return 'The playground name must be a valid slang identifier.';
          }

          return true;
        },
      });

      path = response.playground;
    }
    const playgroundPath = path;

    if (providers === undefined || providers.length === 0) {
      const response: { providers: string } = await inquirer.prompt({
        name: 'providers',
        message: 'Input space separated list of providers to create',
        type: 'input',
        validate: (input: string): boolean => {
          const providers = Play.parseProviderNames(input);

          return providers.length > 0;
        },
      });
      providers = Play.parseProviderNames(response.providers);
    }

    this.debug('Playground path:', playgroundPath);
    this.debug('Providers:', providers);
    await initializePlayground(playgroundPath, providers, this.logCallback);
  }

  // EXECUTE //

  private async runExecute(
    playgroundPath: string | undefined,
    providers: string[] | undefined,
    skip: Record<'npm' | 'ast' | 'tsc', SkipFileType>
  ): Promise<void> {
    if (playgroundPath === undefined) {
      playgroundPath = await Play.promptExistingPlayground();
    }
    const playground = await detectPlayground(playgroundPath);

    if (providers === undefined || providers.length === 0) {
      const response: { providers: string[] } = await inquirer.prompt({
        name: 'providers',
        message: 'Select a provider to execute',
        type: 'checkbox',
        choices: [...playground.providers.values()].map(p => {
          return { name: p };
        }),
        validate: (input: string[]): boolean => {
          return input.length > 0;
        },
      });
      providers = response.providers;
    } else {
      for (const provider of providers) {
        if (!playground.providers.has(provider)) {
          throw userError(
            `Provider "${provider}" not found for playground "${playground.path}"`,
            21
          );
        }
      }
    }

    this.debug('Playground:', playground);
    this.debug('Providers:', providers);
    this.debug('Skip:', skip);
    await executePlayground(playground, providers, skip, this.logCallback);
  }

  // CLEAN //

  private async runClean(playgroundPath: string | undefined): Promise<void> {
    if (playgroundPath === undefined) {
      playgroundPath = await Play.promptExistingPlayground();
    }
    const playground = await detectPlayground(playgroundPath);

    this.debug('Playground:', playground);
    await cleanPlayground(playground, this.logCallback);
  }

  // UTILITY //

  private static parseProviderNames(input: string): string[] {
    return input
      .split(' ')
      .filter(i => i.trim() !== '')
      .filter(validateDocumentName);
  }

  private static async promptExistingPlayground(): Promise<string> {
    const response: { playground: string } = await inquirer.prompt({
      name: 'playground',
      message: `Path to playground to execute (navigate to a valid playground, use space to expand folders)`,
      type: 'file-tree-selection',
      onlyShowValid: false,
      onlyShowDir: true,
      hideChildrenOfValid: true,
      validate: async (input: unknown): Promise<boolean> => {
        if (typeof input !== 'string') {
          throw developerError('unexpected argument type', 21);
        }

        try {
          await detectPlayground(input);
        } catch (e) {
          return false;
        }

        return true;
      },
    } as typeof FileTreeSelectionPrompt); // have to cast because the registration of the new prompt is not known to typescript

    return response.playground;
  }
}
