import { Command, flags } from '@oclif/command';
import { grey } from 'chalk';
import inquirer from 'inquirer';
import FileTreeSelectionPrompt from 'inquirer-file-tree-selection-prompt';
import { basename } from 'path';

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
import { TemplateType } from '../templates/common';

inquirer.registerPrompt('file-tree-selection', FileTreeSelectionPrompt);

type ActionType = 'initialize' | 'execute' | 'clean';
function isActionType(input: unknown): input is ActionType {
  return (
    typeof input === 'string' &&
    (input === 'initialize' || input === 'execute' || input === 'clean')
  );
}

export default class Play extends Command {
  static description = `Manages and executes playgrounds. Missing arguments are interactively prompted.
Playground is a scaffolded application representing a minimum working example needed to make use of superface. This command has the following action subcommands:
initialize: a playground is populated with an templated profile, a pair of map and provider.json for each provider and a play script in the \`superface/play\` directory.
execute: the profile, the selected maps and the play script are compiled and the script is executed.
clean: the \`superface/node_modules\` folder and \`superface/build\` build artifacts are cleaned.`;

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
    template: flags.string({
      options: ['empty', 'pubs'],
      default: 'pubs',
      description: 'Template to initialize the profiles and maps with.',
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
        'When set to true, disables the shell echo output of play actions.\nAlso overrides the default value of `--debug-level` to an empty string.',
      default: false,
    }),
    'debug-level': flags.string({
      description:
        '[default: *] Controls the value of the env variable `DEBUG` passed when executing the playground glue.\nPass an empty string to disable. Defaults to an empty string when `--quiet` is also passed.',
    }),

    help: flags.help({ char: 'h' }),
  };

  private logCallback? = (message: string) => this.log(grey(message));

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

    let debugLevel = flags['debug-level'];
    if (flags.quiet === true) {
      this.logCallback = undefined;
      debugLevel = '';
    } else if (debugLevel === undefined) {
      debugLevel = '*';
    }

    if (action === 'initialize') {
      // typecheck the template flag
      switch (flags.template) {
        case 'empty':
        case 'pubs':
          break;
        default:
          throw developerError('Invalid --template flag option', 1);
      }

      await this.runInitialize(
        args.playground,
        flags.providers,
        flags.template
      );
    } else if (action === 'execute') {
      await this.runExecute(
        args.playground,
        flags.providers,
        {
          npm: flags['skip-npm'] ?? flags.skip,
          ast: flags['skip-ast'] ?? flags.skip,
          tsc: flags['skip-tsc'] ?? flags.skip,
        },
        debugLevel
      );
    } else if (action === 'clean') {
      await this.runClean(args.playground);
    }
  }

  // INITIALIZE //

  private async runInitialize(
    path: string | undefined,
    providers: string[] | undefined,
    template: TemplateType
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

          const baseName = basename(input);
          if (!validateDocumentName(baseName)) {
            return 'The playground name must be a valid slang identifier.';
          }

          return true;
        },
      });

      path = response.playground;
    }
    const playgroundPath = path;

    const baseName = basename(playgroundPath);
    if (!validateDocumentName(baseName)) {
      throw userError(
        'The playground name must be a valid slang identifier',
        11
      );
    }

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
    await initializePlayground(
      playgroundPath,
      {
        name: baseName,
        providers,
      },
      template,
      {
        logCb: this.logCallback,
      }
    );
  }

  // EXECUTE //

  private async runExecute(
    playgroundPath: string | undefined,
    providers: string[] | undefined,
    skip: Record<'npm' | 'ast' | 'tsc', SkipFileType>,
    debugLevel: string
  ): Promise<void> {
    if (playgroundPath === undefined) {
      playgroundPath = await Play.promptExistingPlayground();
    }
    const playground = (await detectPlayground(playgroundPath))[0]; // TODO: Do something about multiple instances

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
        if (!playground.providers.includes(provider)) {
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
    await executePlayground(playground, providers, skip, {
      debugLevel,
      logCb: this.logCallback,
    });
  }

  // CLEAN //

  private async runClean(playgroundPath: string | undefined): Promise<void> {
    if (playgroundPath === undefined) {
      playgroundPath = await Play.promptExistingPlayground();
    }
    const playground = (await detectPlayground(playgroundPath))[0]; // TODO: Do something about multiple instances

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
