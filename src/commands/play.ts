import { Command, flags } from '@oclif/command';
import * as nodePath from 'path';
import { userError, developerError } from '../common/error';
import { accessPromise, readdirPromise, statPromise } from '../common/io';
import * as inquirer from 'inquirer';
import FileTreeSelectionPrompt from 'inquirer-file-tree-selection-prompt';
import Compile from './compile';
import {} from './create';

import * as childProcess from 'child_process';
import { promisify } from 'util';

export const execPromise = promisify(childProcess.exec);
export const forkPromise = promisify(childProcess.fork);

// Playground is a folder F which contains a profile (`F.supr`), maps (`F.*.suma`) and glue scripts (`F.*.ts`) where `*` denotes provider name.
// When initialized a playground is populated with example profile, map and glue.
// When executed the profile, map and glue scripts are compiled and the specified (or default) provider is executed.

// $ superface play init PubHours
// Initializing playground "PubHours" (`PubHours.supr`, `PubHours.default.suma`, `PubHours.default.ts`)

// $ superface play init PubHours --providers osm,gmaps
// Initializing playground "PubHours" (`PubHours.supr`, `PubHours.osm.suma`, `PubHours.osm.ts`, `PubHours.gmaps.suma`, `PubHours.gmaps.ts`)

// $ superface play execute PubHours
// Executing playground "PubHours" with provider "default" (`PubHours.supr`, `PubHours.default.suma`, `PubHours.default.ts`)

// $ superface play execute PubHours --provider osm
// Executing playground "PubHours" with provider "osm" (`PubHours.supr`, `PubHours.osm.suma`, `PubHours.osm.ts`)

inquirer.registerPrompt('file-tree-selection', FileTreeSelectionPrompt)

type ActionType = 'initialize' | 'execute';
interface PlaygroundFolder {
  name: string,
  path: string,
  providers: string[]
};

export default class Play extends Command {
  static description = `Manages and executes playgrounds.
Playground is a folder F which contains a profile (\`F.supr\`), maps (\`F.*.suma\`) and glue scripts (\`F.*.ts\`) where \`*\` denotes provider name.
When initialized: a playground is populated with example profile, map and glue script.
When executed: the profile, map and glue scripts are compiled and the specified (or default) provider glue script is executed.`
    ;

  static examples = [
    'superface play',
    'superface play init PubHours --providers osm,gmaps',
    'superface play execute PubHours --provider osm'
  ];

  static args = [{
    name: 'action',
    description: 'Action to take.',
    required: false,
    options: ['initialize', 'execute'] as ActionType[]
  }, {
    name: 'playground',
    description: 'Path to the playground to initialize or execute.',
    required: false
  }];

  static flags = {
    provider: flags.string({
      char: 'p',
      description: 'Provider to execute.'
    }),    

    help: flags.help({ char: 'h' }),
  };

  async run(): Promise<void> {
    const { args, flags } = this.parse(Play);

    let action: ActionType = args.action;
    if (action === undefined) {
      const response = await inquirer.prompt({
        name: 'action',
        message: 'Select an action',
        type: 'list',
        choices: [{
          name: 'Initialize a new playground',
          value: 'initialize'
        }, {
          name: 'Execute an existing playground',
          value: 'execute'
        }],
      });
      action = response.action;
    };
    this.debug("Action:", action);

    if (action === 'initialize') {
      await this.runInitialize(args.playground);
    } else if (action == 'execute') {
      await this.runExecute(args.playground, flags.provider);
    }
  }

  private async runInitialize(playgroundPath: string | undefined): Promise<void> {
    if (playgroundPath === undefined) {
      const response: { playground: string } = await inquirer.prompt({
        name: 'playground',
        message: `Path to playground to initialize`,
        type: 'input',
        validate: async (input: any): Promise<boolean | string> => {
          if (typeof input !== 'string') {
            throw developerError('unexpected argument type', 1);
          }

          if (input.trim().length === 0) {
            return 'The playground path must not be empty.'
          }

          try {
            await accessPromise(input);
          } catch (e) {
            // We are looking for a non-existent path
            if (e.code === 'ENOENT') {
              return true;
            }
          }

          return 'The playground path must not exist.';
        }
      });

      playgroundPath = response.playground;
    }

    this.debug("Playground path:", playgroundPath);
  }

  private async runExecute(playgroundPath: string | undefined, provider: string | undefined): Promise<void> {
    if (playgroundPath === undefined) {
      const response: { playground: string } = await inquirer.prompt({
        name: 'playground',
        message: `Path to playground to execute (navigate to a valid playground, use space to folders)`,
        type: 'file-tree-selection',
        onlyShowValid: false,
        onlyShowDir: true,
        hideChildrenOfValid: true,
        validate: async (input: any): Promise<boolean> => {
          if (typeof input !== 'string') {
            throw developerError('unexpected argument type', 1);
          }

          try {
            await Play.detectPlayground(input);
          } catch (e) {
            return false;
          }

          return true;
        }
      } as any); // have to cast to any because the registration of the new prompt is not known to typescript
      playgroundPath = response.playground;
    }
    const playground = await Play.detectPlayground(playgroundPath);

    if (provider === undefined) {
      const response: { provider: string } = await inquirer.prompt({
        name: 'provider',
        message: 'Select a provider',
        type: 'list',
        choices: playground.providers.map(p => {
          return { name: p }
        })
      });
      provider = response.provider;
    } else {
      if (!playground.providers.includes(provider)) {
        throw userError(`Provider "${provider}" not found for playground "${playground.path}"`, 4);
      }
    }

    this.debug("Playground:", playground);
    this.debug("Provider:", provider);
    await this.executePlayground(playground, provider);
  }

  private async executePlayground(playground: PlaygroundFolder, provider: string): Promise<void> {
    const profilePath = nodePath.join(playground.path, `${playground.name}.supr`);
    const mapPath = nodePath.join(playground.path, `${playground.name}.${provider}.suma`);
    const gluePath = nodePath.join(playground.path, `${playground.name}.${provider}.ts`);
    // Not joined because we modity the cwd for the fork
    const compiledGluePath = `${playground.name}.${provider}.js`;

    this.log(`$ superface compile '${profilePath}' '${mapPath}'`);
    try {
      await Compile.run([profilePath, mapPath]);
    } catch (err) {
      throw userError(`superface compilation failed: ${err.message}`, 5);
    }

    const compileCommand = `tsc '${gluePath}'`;
    this.log(`$ ${compileCommand}`);
    try {
      await execPromise(compileCommand);
    } catch (err) {
      throw userError(`tsc compilation failed: ${err.stdout}`, 6);
    }

    this.log(`$ DEBUG='*' '${process.execPath}' '${compiledGluePath}'`);
    await forkPromise(compiledGluePath, [], {
      cwd: playground.path,
      stdio: 'inherit',
      env: {
        ...process.env,
        'DEBUG': '*'
      }
    });
  }

  /**
   * Detects playground at specified directory path or throws.
   */
  private static async detectPlayground(path: string): Promise<PlaygroundFolder> {
    let stat;
    try {
      stat = await statPromise(path);
    } catch (e) {
      throw userError('The playground path must exist and be accessible', 1);
    };

    if (!stat.isDirectory()) {
      throw userError('The playground path must be a directory', 2);
    };

    const baseName = nodePath.basename(path);
    const startName = baseName + '.';
    const entries = await readdirPromise(path);

    let foundProfile = false;
    let foundMaps: Set<string> = new Set();
    let foundGlues: Set<string> = new Set();

    entries.filter(
      e => e.startsWith(startName)
    ).forEach(
      entry => {
        if (entry === `${startName}supr`) {
          foundProfile = true;
          return;
        }

        if (entry.endsWith('.suma')) {
          const provider = entry.slice(
            startName.length,
            entry.length - '.suma'.length
          );

          foundMaps.add(provider);
          return;
        }

        if (entry.endsWith('.ts')) {
          const provider = entry.slice(
            startName.length,
            entry.length - '.ts'.length
          );

          foundGlues.add(provider);
          return;
        }
      }
    );

    let providers: string[] = [];
    for (const x of foundMaps) {
      if (foundGlues.has(x)) {
        providers.push(x)
      }
    };

    if (foundProfile && providers.length > 0) {
      return {
        name: baseName,
        path,
        providers
      };
    }

    throw userError('The directory at playground path is not a playground', 3);
  }
}