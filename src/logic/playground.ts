import { Stats } from 'fs';
import nodePath from 'path';

import Compile from '../commands/compile';
import {
  DEFAULT_PROFILE_VERSION,
  MAP_EXTENSIONS,
  PROFILE_EXTENSIONS,
  validateDocumentName,
} from '../common/document';
import {
  assertIsExecError,
  assertIsGenericError,
  userError,
} from '../common/error';
import { SkipFileType } from '../common/flags';
import {
  execFile,
  mkdir,
  OutputStream,
  readdir,
  realpath,
  resolveSkipFile,
  rimraf,
  stat,
} from '../common/io';
import { formatShellLog } from '../common/log';
import * as mapTemplate from '../templates/map';
import * as playgroundTemplate from '../templates/playground';
import * as profileTemplate from '../templates/profile';

export interface PlaygroundInstance {
  /**
   * Absolute path to the playground instance.
   */
  path: string;
  /**
   * Name of the instance. Corresponds to the name of the profile that is executed.
   */
  name: string;
  /**
   * Set of providers that are contained within the playground instance.
   */
  providers: Set<string>;
}

type LogCallback = (message: string) => void;
const BUILD_DIR = 'build';

type PlaygroundPaths = {
  /** Path to the playground itself. */
  base: string;
  /** Path to the profile source. */
  profile: string;
  /** Path to the map sources. */
  maps: string[];
  /** Path to the play script. */
  script: string;
  /** Path to package.json */
  npm: string;

  /** Paths to build artifacts. */
  build: {
    /** Path to the build directory. */
    base: string;
    /** Profile ast */
    profile: string;
    /** Map asts */
    maps: string[];
    /** Transpiled play script */
    script: string;
    /** package-lock.json and node_modules */
    npm: string[];
  };
};

/** Returns paths for build artifacts for given playground. */
function playgroundBuildPaths(
  playgroundPath: string,
  profileName: string,
  providers: string[]
): PlaygroundPaths['build'] {
  const base = nodePath.join(playgroundPath, BUILD_DIR);

  const profile = nodePath.join(base, `${profileName}.supr.ast.json`);
  const maps = providers.map(provider =>
    nodePath.join(base, `${profileName}.${provider}.suma.ast.json`)
  );
  const script = nodePath.join(base, `${profileName}.play.js`);
  const npm = [
    nodePath.join(playgroundPath, 'package-lock.json'),
    nodePath.join(playgroundPath, 'node_modules'),
  ];

  return {
    base,
    profile,
    maps,
    script,
    npm,
  };
}

/** Returns paths for all files for given playground. */
function playgroundFilePaths(
  base: string,
  profileName: string,
  providers: string[]
): PlaygroundPaths {
  const profile = nodePath.join(base, `${profileName}.supr`);
  const maps = providers.map(provider =>
    nodePath.join(base, `${profileName}.${provider}.suma`)
  );
  const script = nodePath.join(base, `${profileName}.play.ts`);
  const npm = nodePath.join(base, 'package.json');

  return {
    base,
    profile,
    maps,
    script,
    npm,
    build: playgroundBuildPaths(base, profileName, providers),
  };
}

/**
 * Finds providers for given profile name, if any.
 */
function detectPlaygroundProviders(
  entries: readonly string[],
  name: string
): Set<string> {
  const startName = name + '.';
  const providers = new Set(
    entries
      .filter(
        entry =>
          entry.startsWith(startName) && entry.endsWith(MAP_EXTENSIONS[0])
      )
      .map(entry =>
        entry.slice(startName.length, entry.length - MAP_EXTENSIONS[0].length)
      )
  );

  return providers;
}

/**
 * Detects playground at specified directory path or rejects.
 *
 * Looks for `package.json`, `<name>.supr` and corresponding `<name>.<provider>.suma` and `<name>.play.ts`.
 */
export async function detectPlayground(
  path: string
): Promise<PlaygroundInstance[]> {
  // Ensure that the folder exists, is accesible and is a directory.
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

  const entries = (await readdir(realPath, { withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => entry.name);

  if (!entries.includes('package.json')) {
    throw userError(
      'The directory at playground path is not a playground: no package.json found',
      33
    );
  }

  const foundProfiles = entries.filter(entry =>
    entry.endsWith(PROFILE_EXTENSIONS[0])
  );
  if (foundProfiles.length === 0) {
    throw userError(
      'The directory at playground path is not a playground: no profile found',
      34
    );
  }

  const instances = [];
  for (const foundProfile of foundProfiles) {
    const name = foundProfile.slice(
      0,
      foundProfile.length - PROFILE_EXTENSIONS[0].length
    );

    const providers = detectPlaygroundProviders(entries, name);
    const scriptExists = entries.includes(`${name}.play.ts`);

    if (scriptExists && providers.size !== 0) {
      instances.push({
        path: realPath,
        name,
        providers,
      });
    }
  }

  if (instances.length === 0) {
    throw userError(
      'The directory at playground path is not a playground: no providers or play scripts found',
      35
    );
  }

  return instances;
}

// TODO: Make more use of the create command
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
  await mkdir(playgroundPath, { recursive: true, mode: 0o744 });

  const packageJsonPath = nodePath.join(playgroundPath, 'package.json');
  logCb?.(`$ echo '<package template>' > ${packageJsonPath}`);
  const packageJsonPromise = OutputStream.writeOnce(
    packageJsonPath,
    playgroundTemplate.packageJson()
  );

  const scriptPath = nodePath.join(playgroundPath, `${name}.play.ts`);
  logCb?.(`$ echo '<script template>' > ${scriptPath}`);

  const scriptPromise = OutputStream.writeOnce(
    scriptPath,
    playgroundTemplate.pubs(name)
  );

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
    profilePromise,
    ...mapsPromises,
    scriptPromise,
    npmrcPromise,
    gitignorePromise,
  ]);
}

export async function executePlayground(
  playground: PlaygroundInstance,
  providers: string[],
  skip: Record<'npm' | 'ast' | 'tsc', SkipFileType>,
  options: {
    debugLevel: string;
    logCb?: LogCallback;
  }
): Promise<void> {
  const paths = playgroundFilePaths(
    playground.path,
    playground.name,
    providers
  );
  await mkdir(paths.build.base, { recursive: true, mode: 0o744 });

  const skipNpm = await resolveSkipFile(skip.npm, paths.build.npm);
  if (!skipNpm) {
    options.logCb?.(formatShellLog('npm install'));
    try {
      await execFile('npm', ['install'], {
        cwd: playground.path,
      });
    } catch (err) {
      assertIsExecError(err);
      throw userError(`npm install failed:\n${err.stderr}`, 22);
    }
  }

  const skipAst = await resolveSkipFile(skip.ast, paths.build.maps);
  if (!skipAst) {
    options.logCb?.(
      formatShellLog('superface compile --output', [
        paths.build.base,
        ...paths.maps,
      ])
    );

    try {
      await Compile.run([
        '--output',
        paths.build.base,
        paths.profile,
        ...paths.maps,
      ]);
    } catch (err) {
      assertIsGenericError(err);
      throw userError(`superface compilation failed: ${err.message}`, 23);
    }
  }

  const skipTsc = await resolveSkipFile(skip.tsc, [paths.script]);
  if (!skipTsc) {
    options.logCb?.(
      formatShellLog(
        'tsc --strict --target ES2015 --module commonjs --outDir',
        [paths.build.base, paths.script]
      )
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
          paths.build.base,
          paths.script,
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

  // execute the play script
  {
    const scriptArgs = providers.map(
      provider => `${playground.name}.${provider}`
    );

    // log and handle debug level flag
    options.logCb?.(
      formatShellLog(
        undefined,
        [process.execPath, paths.build.script, ...scriptArgs],
        { DEBUG: options.debugLevel }
      )
    );

    // actually exec
    await execFile(
      process.execPath,
      [paths.build.script, ...scriptArgs],
      {
        cwd: playground.path,
        env: {
          ...process.env,
          // enable colors when we are forwarding to TTY stdout
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
  playground: PlaygroundInstance,
  logCb?: LogCallback
): Promise<void> {
  const buildPaths = playgroundBuildPaths(playground.path, playground.name, [
    ...playground.providers.values(),
  ]);
  const files = [
    buildPaths.profile,
    ...buildPaths.maps,
    buildPaths.script,
    ...buildPaths.npm,
  ];
  logCb?.(formatShellLog('rimraf', files));

  await Promise.all(files.map(f => rimraf(f)));
}
