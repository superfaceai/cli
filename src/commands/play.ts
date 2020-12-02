import { Command, flags } from '@oclif/command';
import * as nodePath from 'path';
import { userError, developerError } from '../common/error';
import { accessPromise, readdirPromise, statPromise, rimrafPromise, execFilePromise, resolveSkipFile, mkdirPromise, OutputStream } from '../common/io';
import * as inquirer from 'inquirer';
import FileTreeSelectionPrompt from 'inquirer-file-tree-selection-prompt';
import Compile from './compile';
import chalk from 'chalk';

import ts from 'typescript';
import { skipFileFlag, SkipFileType } from '../common/flags';
import { validateDocumentName } from '../common/document';

import * as playgroundTemplate from '../templates/playground';
import * as profileTemplate from '../templates/profile';
import * as mapTemplate from '../templates/map';

inquirer.registerPrompt('file-tree-selection', FileTreeSelectionPrompt)

type ActionType = 'initialize' | 'execute' | 'clean';
interface PlaygroundFolder {
  name: string,
  path: string,
  providers: Set<string>
};

export default class Play extends Command {
  static description = `Manages and executes interactive playgrounds. Missing arguments are interactively prompted.
Playground is a folder F which contains a profile (\`F.supr\`), maps (\`F.*.suma\`) and glue scripts (\`F.*.ts\`) where \`*\` denotes provider name.
initialize: a playground is populated with an example profile, and a pair of a map and a glue script for each provider.
execute: the profile, and the selected pairs of a map and a glue script are compiled and the specified provider glue scripts are executed.
clean: the \`node_modules\` folder and compilation artifacts are cleaned.`
    ;

  static examples = [
    'superface play',
    'superface play initialize PubHours --providers osm gmaps',
    'superface play execute PubHours --providers osm',
    'superface play clean PubHours'
  ];

  static args = [{
    name: 'action',
    description: 'Action to take.',
    required: false,
    options: ['initialize', 'execute', 'clean']
  }, {
    name: 'playground',
    description: 'Path to the playground to initialize or execute.',
    required: false
  }];

  static flags = {
    providers: flags.string({
      char: 'p',
      multiple: true,
      description: 'Providers to initialize or execute.'
    }),

    skip: skipFileFlag({
      description: 'Controls the fallback skipping behavior of more specific skip flags.\nSee `--skip-npm`, `--skip-ast`, and `--skip-tsc` for more details.',
      default: 'never'
    }),
    'skip-npm': skipFileFlag({
      description: 'Control skipping behavior of the npm install execution step.\n`exists` checks for the presence of `node_modules` directory.'
    }),
    'skip-ast': skipFileFlag({
      description: 'Control skipping behavior of the superface ast compile execution step.\n`exists` checks for the presence of `<name>.<provider>.suma.ast.json` files.'
    }),
    'skip-tsc': skipFileFlag({
      description: 'Control skipping behavior of the tsc compile execution step.\n`exists` checks for the presence of `<name>.<provider>.js files.'
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
        }, {
          name: 'Clean an existing playground',
          value: 'clean'
        }],
      });
      action = response.action;
    };
    this.debug("Action:", action);

    if (action === 'initialize') {
      await this.runInitialize(args.playground, flags.providers);
    } else if (action === 'execute') {
      await this.runExecute(args.playground, flags.providers, {
        npm: flags["skip-npm"] ?? flags.skip,
        ast: flags["skip-ast"] ?? flags.skip,
        tsc: flags["skip-tsc"] ?? flags.skip
      });
    } else if (action === 'clean') {
      await this.runClean(args.playground);
    } else {
      throw developerError('Invalid action', 1);
    }
  }

  // INITIALIZE //

  private async runInitialize(path: string | undefined, providers: string[] | undefined): Promise<void> {
    if (path === undefined) {
      const response: { playground: string } = await inquirer.prompt({
        name: 'playground',
        message: `Path to playground to initialize`,
        type: 'input',
        validate: async (input: any): Promise<boolean | string> => {
          if (typeof input !== 'string') {
            throw developerError('unexpected argument type', 11);
          }

          if (input.trim().length === 0) {
            return 'The playground path must not be empty.'
          }

          let exists = true;
          try {
            await accessPromise(input);
          } catch (e) {
            // We are looking for a non-existent path
            if (e.code === 'ENOENT') {
              exists = false;
            }
          }
          if (exists) {
            return 'The playground path must not exist.';
          }

          const baseName = nodePath.basename(input);
          if (!validateDocumentName(baseName)) {
            return 'The playground name must be a valid slang identifier.';
          }

          return true;
        }
      });

      path = response.playground;
    }
    const playgroundPath = path;

    const name = nodePath.basename(playgroundPath);
    if (!validateDocumentName(name)) {
      throw userError('The playground name must be a valid slang identifier', 11);
    }

    if (providers === undefined || providers.length === 0) {
      const response: { providers: string } = await inquirer.prompt({
        name: 'providers',
        message: 'Input space separated list of providers to create',
        type: 'input',
        validate: (input: string): boolean => {
          const providers = Play.parseProviderNames(input);

          return providers.length > 0;
        }
      });
      providers = Play.parseProviderNames(response.providers);
    }

    this.debug("Playground path:", playgroundPath);
    this.debug("Playground name:", name);
    this.debug("Providers:", providers);

    await mkdirPromise(playgroundPath, { recursive: true, mode: 0o744 });

    const packageJsonPromise = OutputStream.writeOnce(
      nodePath.join(playgroundPath, 'package.json'),
      playgroundTemplate.packageJson(name)
    );

    const gluesPromises = providers.map(
      provider => OutputStream.writeOnce(
        nodePath.join(playgroundPath, `${name}.${provider}.ts`),
        playgroundTemplate.glueScript('pubs', name, provider)
      )
    );

    const profilePromise = OutputStream.writeOnce(
      nodePath.join(playgroundPath, `${name}.supr`),
      profileTemplate.header(name) + profileTemplate.pubs(name)
    );

    const mapsPromises = providers.map(
      provider => OutputStream.writeOnce(
        nodePath.join(playgroundPath, `${name}.${provider}.suma`),
        mapTemplate.header(name, provider) + mapTemplate.pubs(name)
      )
    );

    const npmrcPromise = OutputStream.writeOnce(
      nodePath.join(playgroundPath, '.npmrc'),
      playgroundTemplate.npmRc()
    );

    await Promise.all(
      [
        packageJsonPromise,
        ...gluesPromises,
        profilePromise,
        ...mapsPromises,
        npmrcPromise
      ]
    )
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
    const playground = await Play.detectPlayground(playgroundPath);

    if (providers === undefined || providers.length === 0) {
      const response: { providers: string[] } = await inquirer.prompt({
        name: 'providers',
        message: 'Select a provider to execute',
        type: 'checkbox',
        choices: [...playground.providers.values()].map(p => {
          return { name: p }
        }),
        validate: (input: string[]): boolean => {
          return input.length > 0;
        }
      });
      providers = response.providers;
    } else {
      for (const provider of providers) {
        if (!playground.providers.has(provider)) {
          throw userError(`Provider "${provider}" not found for playground "${playground.path}"`, 21);
        }
      }
    }

    this.debug("Playground:", playground);
    this.debug("Providers:", providers);
    this.debug("Skip:", skip);
    await this.executePlayground(playground, providers, skip);
  }

  private async executePlayground(
    playground: PlaygroundFolder,
    providers: string[],
    skip: Record<'npm' | 'ast' | 'tsc', SkipFileType>
  ): Promise<void> {
    const profilePath = nodePath.join(playground.path, `${playground.name}.supr`);
    const mapPaths = providers.map(
      provider => nodePath.join(playground.path, `${playground.name}.${provider}.suma`)
    );

    const gluePaths = providers.map(
      provider => nodePath.join(playground.path, `${playground.name}.${provider}.ts`)
    );
    const compiledGluePaths = providers.map(
      provider => `${playground.name}.${provider}.js`
    );

    const skipNpm = await resolveSkipFile(skip.npm, [nodePath.join(playground.path, 'node_modules')]);
    if (!skipNpm) {
      this.logCli('$ npm install');
      try {
        await execFilePromise('npm', ['install'], {
          cwd: playground.path
        });
      } catch (err) {
        throw userError(`npm install failed: ${err.stdout}`, 22);
      }
    }

    const skipAst = await resolveSkipFile(skip.ast, mapPaths.map(m => `${m}.ast.json`));
    if (!skipAst) {
      this.logCli(`$ superface compile '${profilePath}' ${mapPaths.map(p => `'${p}'`).join(' ')}`);
      try {
        await Compile.run([profilePath, ...mapPaths]);
      } catch (err) {
        throw userError(`superface compilation failed: ${err.message}`, 23);
      }
    }

    const skipTsc = await resolveSkipFile(skip.tsc, compiledGluePaths.map(g => nodePath.join(playground.path, g)));
    if (!skipTsc) {
      this.logCli(`$ tsc ${gluePaths.map(p => `'${p}'`).join(' ')}`);
      const program = ts.createProgram(
        gluePaths,
        {
          sourceMap: false,
          outDir: playground.path,
          declaration: false,
          target: ts.ScriptTarget.ES2015,
          module: ts.ModuleKind.CommonJS,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          strict: true,
          noEmitOnError: true,
          typeRoots: ["node_modules/@types"]
        }
      );
      const result = program.emit();

      if (result.emitSkipped) {
        let diagnosticMessage = '\n';

        for (const diagnostic of result.diagnostics) {
          if (!diagnostic.file || !diagnostic.start) {
            throw developerError('Invalid typescript compiler diagnostic output', 21);
          }

          let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
          let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");

          diagnosticMessage += `\t${diagnostic.file.fileName}:${line + 1}:${character + 1} ${message}`;
        }

        throw userError(`Typescript compilation failed: ${diagnosticMessage}`, 24);
      }
    }

    for (const compiledGluePath of compiledGluePaths) {
      this.logCli(`$ DEBUG='*' '${process.execPath}' '${compiledGluePath}'`);

      await execFilePromise(
        process.execPath,
        [compiledGluePath],
        {
          cwd: playground.path,
          env: {
            ...process.env,
            'DEBUG': '*'
          }
        },
        {
          forwardStdout: true,
          forwardStderr: true
        }
      )
    }
  }

  // CLEAN //

  private async runClean(playgroundPath: string | undefined): Promise<void> {
    if (playgroundPath === undefined) {
      playgroundPath = await Play.promptExistingPlayground();
    }
    const playground = await Play.detectPlayground(playgroundPath);

    this.debug("Playground:", playground);

    const files = [
      `${playground.name}.supr.ast.json`,
      'node_modules',
      'package-lock.json'
    ];
    for (const provider of playground.providers.values()) {
      files.push(
        `${playground.name}.${provider}.suma.ast.json`
      );
      files.push(
        `${playground.name}.${provider}.js`,
      );
    }
    this.logCli(`$ rimraf ${files.map(f => `'${f}'`).join(' ')}`);

    await Promise.all(
      files.map(
        file => rimrafPromise(
          nodePath.join(playground.path, file)
        )
      )
    );
  }

  // UTILITY //

  private static parseProviderNames(input: string): string[] {
    return input.split(' ').filter(
      i => i.trim() !== ''
    ).filter(
      p => validateDocumentName(p)
    );
  }

  private static async promptExistingPlayground(): Promise<string> {
    const response: { playground: string } = await inquirer.prompt({
      name: 'playground',
      message: `Path to playground to execute (navigate to a valid playground, use space to expand folders)`,
      type: 'file-tree-selection',
      onlyShowValid: false,
      onlyShowDir: true,
      hideChildrenOfValid: true,
      validate: async (input: any): Promise<boolean> => {
        if (typeof input !== 'string') {
          throw developerError('unexpected argument type', 21);
        }

        try {
          await Play.detectPlayground(input);
        } catch (e) {
          return false;
        }

        return true;
      }
    } as any); // have to cast to any because the registration of the new prompt is not known to typescript

    return response.playground;
  }

  /**
   * Detects playground at specified directory path or rejects.
   *
   * Looks for all of these files:
   * - `package.json`
   * - `<folder-name>.supr`
   * - `<folder-name>.*.suma` (at least one pair with `.ts` below)
   * - `<folder-name>.*.ts`
   */
  private static async detectPlayground(path: string): Promise<PlaygroundFolder> {
    let stat;
    try {
      stat = await statPromise(path);
    } catch (e) {
      throw userError('The playground path must exist and be accessible', 31);
    };

    if (!stat.isDirectory()) {
      throw userError('The playground path must be a directory', 32);
    };

    const baseName = nodePath.basename(path);
    const startName = baseName + '.';
    const entries = await readdirPromise(path);

    let foundPackageJson = false;
    let foundProfile = false;
    let foundMaps: Set<string> = new Set();
    let foundGlues: Set<string> = new Set();

    for (const entry of entries) {
      if (entry === 'package.json') {
        foundPackageJson = true;
      } else if (entry.startsWith(startName)) {
        if (entry === `${startName}supr`) {
          foundProfile = true;
          continue;
        }

        if (entry.endsWith('.suma')) {
          const provider = entry.slice(
            startName.length,
            entry.length - '.suma'.length
          );

          foundMaps.add(provider);
          continue;
        }

        if (entry.endsWith('.ts')) {
          const provider = entry.slice(
            startName.length,
            entry.length - '.ts'.length
          );

          foundGlues.add(provider);
          continue;
        }
      }
    }

    let providers: Set<string> = new Set();
    for (const x of foundMaps) {
      if (foundGlues.has(x)) {
        providers.add(x);
      }
    };

    if (foundPackageJson && foundProfile && providers.size > 0) {
      return {
        name: baseName,
        path,
        providers
      };
    }

    throw userError('The directory at playground path is not a playground', 33);
  }

  private logCli(message: string) {
    this.log(chalk.grey(message));
  }
}