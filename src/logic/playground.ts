import { Stats } from 'fs';
import nodePath from 'path';

import Compile from '../commands/compile';
import {
  DEFAULT_PROFILE_VERSION,
  validateDocumentName,
} from '../common/document';
import {
  assertIsExecError,
  assertIsGenericError,
  userError,
} from '../common/error';
import { SkipFileType } from '../common/flags';
import {
  createDirectory,
  execFile,
  OutputStream,
  readdir,
  realpath,
  resolveSkipFile,
  rimraf,
  stat,
} from '../common/io';
import { LogCallback } from '../common/types';
import * as mapTemplate from '../templates/map';
import * as playgroundTemplate from '../templates/playground';
import * as profileTemplate from '../templates/profile';

export interface PlaygroundFolder {
  /**
   * Name of the playground. Corresponds to the name of the profile that is executed.
   */
  name: string;
  /**
   * Absolute path to the playground.
   */
  path: string;
  /**
   * Set of providers that are contained within the playground.
   */
  providers: Set<string>;
}

const BUILD_DIR = 'build';

export async function initializePlayground(
  playgroundPath: string,
  providers: string[],
  logCb?: LogCallback
): Promise<void> {
  const name = nodePath.basename(playgroundPath);
  if (!validateDocumentName(name)) {
    throw userError('The playground name must be a valid slang identifier', 11);
  }

  logCb?.(`$ mkdir ${playgroundPath}`);
  await createDirectory(playgroundPath);

  const packageJsonPath = nodePath.join(playgroundPath, 'package.json');
  logCb?.(`$ echo '<package template>' > ${packageJsonPath}`);
  const packageJsonPromise = OutputStream.writeOnce(
    packageJsonPath,
    playgroundTemplate.packageJson(name)
  );

  const gluesPromises = providers.map(provider => {
    const path = nodePath.join(playgroundPath, `${name}.${provider}.ts`);
    logCb?.(`$ echo '<glue template>' > ${path}`);

    return OutputStream.writeOnce(
      path,
      playgroundTemplate.pubs(name, provider)
    );
  });

  const profilePath = nodePath.join(playgroundPath, `${name}.supr`);
  logCb?.(`$ echo '<profile template>' > ${profilePath}`);
  const profilePromise = OutputStream.writeOnce(
    profilePath,
    profileTemplate.header(name, DEFAULT_PROFILE_VERSION) +
      profileTemplate.pubs(name)
  );

  const mapsPromises = providers.map(provider => {
    const path = nodePath.join(playgroundPath, `${name}.${provider}.suma`);
    logCb?.(`$ echo '<map template>' > ${path}`);

    return OutputStream.writeOnce(
      path,
      mapTemplate.header(name, provider, DEFAULT_PROFILE_VERSION) +
        mapTemplate.pubs(name)
    );
  });

  const npmrcPath = nodePath.join(playgroundPath, '.npmrc');
  logCb?.(`$ echo '<npmrc template>' > ${npmrcPath}`);
  const npmrcPromise = OutputStream.writeOnce(
    npmrcPath,
    playgroundTemplate.npmRc()
  );

  const gitignorePath = nodePath.join(playgroundPath, '.gitignore');
  logCb?.(`$ echo '<gitignore template>' > ${gitignorePath}`);
  const gitignorePromise = OutputStream.writeOnce(
    gitignorePath,
    playgroundTemplate.gitignore()
  );

  await Promise.all([
    packageJsonPromise,
    ...gluesPromises,
    profilePromise,
    ...mapsPromises,
    npmrcPromise,
    gitignorePromise,
  ]);
}

export async function executePlayground(
  playground: PlaygroundFolder,
  providers: string[],
  skip: Record<'npm' | 'ast' | 'tsc', SkipFileType>,
  options: {
    debugLevel: string;
    logCb?: LogCallback;
  }
): Promise<void> {
  const profilePath = nodePath.join(playground.path, `${playground.name}.supr`);
  const mapPaths = providers.map(provider =>
    nodePath.join(playground.path, `${playground.name}.${provider}.suma`)
  );
  const gluePaths = providers.map(provider =>
    nodePath.join(playground.path, `${playground.name}.${provider}.ts`)
  );

  const buildPaths = playgroundBuildPaths(playground, providers);
  await createDirectory(buildPaths.base);

  const skipNpm = await resolveSkipFile(skip.npm, buildPaths.npm);
  if (!skipNpm) {
    options.logCb?.('$ npm install');
    try {
      await execFile('npm', ['install'], {
        cwd: playground.path,
      });
    } catch (err) {
      assertIsExecError(err);
      throw userError(`npm install failed:\n${err.stderr}`, 22);
    }
  }

  const skipAst = await resolveSkipFile(skip.ast, buildPaths.maps);
  if (!skipAst) {
    options.logCb?.(
      `$ superface compile --output '${
        buildPaths.base
      }' '${profilePath}' ${mapPaths.map(p => `'${p}'`).join(' ')}`
    );

    try {
      await Compile.run([
        '--output',
        buildPaths.base,
        profilePath,
        ...mapPaths,
      ]);
    } catch (err) {
      assertIsGenericError(err);
      throw userError(`superface compilation failed: ${err.message}`, 23);
    }
  }

  const skipTsc = await resolveSkipFile(skip.tsc, buildPaths.glues);
  if (!skipTsc) {
    options.logCb?.(
      `$ tsc --strict --target ES2015 --module commonjs --outDir ${
        buildPaths.base
      } ${gluePaths.map(p => `'${p}'`).join(' ')}`
    );
    try {
      await execFile(
        nodePath.join('node_modules', '.bin', 'tsc'),
        [
          '--strict',
          '--target',
          'ES2015',
          '--module',
          'commonjs',
          '--outDir',
          buildPaths.base,
          ...gluePaths,
        ],
        {
          cwd: playground.path,
        }
      );
    } catch (err) {
      assertIsExecError(err);
      throw userError(`tsc failed:\n${err.stdout}`, 23);
    }
  }

  for (const compiledGluePath of buildPaths.glues) {
    // log and handle debug level flag
    options.logCb?.(
      `$ DEBUG='${options.debugLevel}' '${process.execPath}' '${compiledGluePath}'`
    );

    // actually exec
    await execFile(
      process.execPath,
      [compiledGluePath],
      {
        cwd: playground.path,
        env: {
          ...process.env,
          // enable colors since we are forwarding stdout
          DEBUG_COLORS: process.stdout.isTTY ? '1' : '',
          DEBUG: options.debugLevel,
        },
      },
      {
        forwardStdout: true,
        forwardStderr: true,
      }
    );
  }
}

export async function cleanPlayground(
  playground: PlaygroundFolder,
  logCb?: LogCallback
): Promise<void> {
  const buildPaths = playgroundBuildPaths(playground, [
    ...playground.providers.values(),
  ]);
  const files = [
    buildPaths.profile,
    ...buildPaths.maps,
    ...buildPaths.glues,
    ...buildPaths.npm,
  ];
  logCb?.(`$ rimraf ${files.map(f => `'${f}'`).join(' ')}`);

  await Promise.all(files.map(f => rimraf(f)));
}

/**
 * Detects playground at specified directory path or rejects.
 *
 * Looks for all of these files:
 * - `package.json`
 * - `<name>.supr` - where the name is inferred from the first `supr` file found
 * - `<name>.*.suma` (at least one pair with `.ts` below)
 * - `<name>.*.ts`
 */
export async function detectPlayground(
  path: string
): Promise<PlaygroundFolder> {
  let realPath: string;
  let statInfo: Stats;
  try {
    realPath = await realpath(path);
    statInfo = await stat(realPath);
  } catch (e) {
    throw userError('The playground path must exist and be accessible', 31);
  }

  if (!statInfo.isDirectory()) {
    throw userError('The playground path must be a directory', 32);
  }

  const entries = await readdir(realPath);

  if (!entries.includes('package.json')) {
    throw userError(
      'The directory at playground path is not a playground: no package.json found',
      33
    );
  }

  const foundProfiles = entries.filter(entry => entry.endsWith('.supr'));
  if (foundProfiles.length === 0) {
    throw userError(
      'The directory at playground path is not a playground: no profile found',
      34
    );
  }
  if (foundProfiles.length >= 2) {
    // TODO
  }

  const name = foundProfiles[0].slice(
    0,
    foundProfiles[0].length - '.supr'.length
  );

  const providers = detectPlaygroundProviders(entries, name);
  if (providers.size === 0) {
    throw userError(
      'The directory at playground path is not a playground: no providers found',
      35
    );
  }

  return {
    name,
    path: realPath,
    providers,
  };
}

/**
 * Finds maps and glues for given profile name, if any.
 */
function detectPlaygroundProviders(
  entries: readonly string[],
  name: string
): Set<string> {
  const maps: Set<string> = new Set();
  const glues: Set<string> = new Set();

  const startName = name + '.';

  entries
    .filter(entry => entry.startsWith(startName))
    .forEach(entry => {
      if (entry.endsWith('.suma')) {
        const provider = entry.slice(
          startName.length,
          entry.length - '.suma'.length
        );

        maps.add(provider);
      } else if (entry.endsWith('.ts')) {
        const provider = entry.slice(
          startName.length,
          entry.length - '.ts'.length
        );

        glues.add(provider);
      }
    });

  const providers: Set<string> = new Set();
  maps.forEach(provider =>
    glues.has(provider) ? providers.add(provider) : undefined
  );

  return providers;
}

function playgroundBuildPaths(
  playground: PlaygroundFolder,
  providers: string[]
): {
  base: string;
  profile: string;
  maps: string[];
  glues: string[];
  npm: string[];
} {
  const buildPath = nodePath.join(playground.path, BUILD_DIR);
  const maps = providers.map(provider =>
    nodePath.join(buildPath, `${playground.name}.${provider}.suma.ast.json`)
  );
  const glues = providers.map(provider =>
    nodePath.join(buildPath, `${playground.name}.${provider}.js`)
  );

  return {
    base: buildPath,
    profile: nodePath.join(buildPath, `${playground.name}.supr.ast.json`),
    glues,
    maps,
    npm: [
      nodePath.join(playground.path, 'package-lock.json'),
      nodePath.join(playground.path, 'node_modules'),
    ],
  };
}
