import { join as joinPath } from 'path';

import Compile from '../commands/compile';
import {
  composeUsecaseName,
  DEFAULT_PROFILE_VERSION,
  MAP_EXTENSIONS,
  PROFILE_EXTENSIONS,
  DEFAULT_PROFILE_VERSION_STR,
} from '../common/document';
import {
  assertIsExecError,
  assertIsGenericError,
  userError,
} from '../common/error';
import { SkipFileType } from '../common/flags';
import {
  execFile,
  isDirectoryQuiet,
  mkdir,
  OutputStream,
  readdir,
  realpath,
  resolveSkipFile,
  rimraf,
} from '../common/io';
import { formatShellLog } from '../common/log';
import { ProfileSettings, ProviderSettings } from '../common/super.interfaces';
import * as playgroundTemplate from '../templates/playground';
import { createMap, createProfile, createProviderJson } from './create';
import { BUILD_DIR, initSuperface, SUPERFACE_DIR } from './init';

export interface PlaygroundInstance {
  /**
   * Absolute path to the playground instance.
   */
  path: string;
  /**
   * Scope of the instance.
   */
  scope?: string;
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
const PLAY_DIR = joinPath(SUPERFACE_DIR, 'play');

type PlaygroundPaths = {
  /** Path to the profile source. */
  profile: string;
  /** Path to the map sources. */
  maps: string[];
  /** Path to the play script. */
  script: string;
  packageJson: string;

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
    nodeModules: string;
    packageLock: string;
  };
};

/** Returns paths for build artifacts for given playground. */
function playgroundBuildPaths(
  appPath: string,
  id: {
    scope?: string;
    name: string;
    providers: string[];
  }
): PlaygroundPaths['build'] {
  const superfacePath = joinPath(appPath, SUPERFACE_DIR);

  let buildPath = joinPath(appPath, BUILD_DIR);
  if (id.scope) {
    buildPath = joinPath(buildPath, id.scope);
  }

  const profile = joinPath(buildPath, `${id.name}.supr.ast.json`);
  const maps = id.providers.map(provider =>
    joinPath(buildPath, `${id.name}.${provider}.suma.ast.json`)
  );
  const script = joinPath(buildPath, `${id.name}.play.js`);
  const packageLock = joinPath(superfacePath, 'package-lock.json');
  const nodeModules = joinPath(superfacePath, 'node_modules');

  return {
    base: buildPath,
    profile,
    maps,
    script,
    packageLock,
    nodeModules,
  };
}

/** Returns paths for all files for given playground. */
function playgroundFilePaths(
  appPath: string,
  id: {
    scope?: string;
    name: string;
    providers: string[];
  }
): PlaygroundPaths {
  let base = appPath;
  let playPath = joinPath(appPath, PLAY_DIR);
  if (id.scope) {
    base = joinPath(base, id.scope);
    playPath = joinPath(playPath, id.scope);
  }

  const superfacePath = joinPath(appPath, SUPERFACE_DIR);

  const profile = joinPath(base, `${id.name}.supr`);
  const maps = id.providers.map(provider =>
    joinPath(base, `${id.name}.${provider}.suma`)
  );

  const script = joinPath(playPath, `${id.name}.play.ts`);
  const packageJson = joinPath(superfacePath, 'package.json');

  return {
    profile,
    maps,
    script,
    packageJson,
    build: playgroundBuildPaths(base, id),
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
  try {
    realPath = await realpath(path);
  } catch (e) {
    throw userError('The playground path must exist and be accessible', 31);
  }
  if (!(await isDirectoryQuiet(realPath))) {
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

/**
 * Initializes a new playground at `appPath`.
 * The structure of the whole playground app is
 * just enhanced `initSuperface` structure:
 * ```
 * appPath/
 *   name.supr
 *   name.provider.suma
 *   provider.provider.json
 *   .npmrc
 *   superface/
 *     super.json
 *     .gitignore
 *     grid/
 *     build/
 *     types/
 *     package.json
 *     play/
 *       scope/
 *         name.play.ts
 * ```
 */
export async function initializePlayground(
  appPath: string,
  id: {
    scope?: string;
    name: string;
    providers: string[];
  },
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  const paths = playgroundFilePaths(appPath, id);

  // initialize the superface directory
  const profiles: ProfileSettings = {
    [(id.scope ? `${id.scope}/` : '') + id.name]: DEFAULT_PROFILE_VERSION_STR,
  };
  const providers: ProviderSettings = {};
  id.providers.forEach(
    providerName => (providers[providerName] = { auth: {} })
  );

  await initSuperface(appPath, profiles, providers, options);

  // create appPath/superface/package.json
  {
    const created = await OutputStream.writeIfAbsent(
      paths.packageJson,
      playgroundTemplate.packageJson,
      { force: options?.force }
    );

    if (created) {
      options?.logCb?.(
        formatShellLog("echo '<package.json template>' >", [paths.packageJson])
      );
    }
  }

  // create appPath/superface/play/scope/name.play.ts
  {
    const created = await OutputStream.writeIfAbsent(
      paths.script,
      () => playgroundTemplate.pubs(id.name),
      { force: options?.force, dirs: true }
    );

    if (created) {
      options?.logCb?.(
        formatShellLog("echo '<play.ts template>' >", [paths.script])
      );
    }
  }

  // appPath/scope/name.supr
  const usecases = [composeUsecaseName(id.name)];
  await createProfile(
    appPath,
    {
      scope: id.scope,
      name: id.name,
      version: DEFAULT_PROFILE_VERSION,
    },
    usecases,
    'pubs',
    options
  );

  for (const provider of id.providers) {
    // appPath/scope/name.provider.supr
    await createMap(
      appPath,
      {
        scope: id.scope,
        name: id.name,
        provider: provider,
        version: DEFAULT_PROFILE_VERSION,
      },
      usecases,
      'pubs',
      options
    );

    // appPath/provider.provider.json
    await createProviderJson(appPath, provider, options);
  }
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
  const paths = playgroundFilePaths(playground.path, {
    scope: playground.scope,
    name: playground.name,
    providers,
  });
  await mkdir(paths.build.base, { recursive: true, mode: 0o744 });

  const skipNpm = await resolveSkipFile(skip.npm, [
    paths.build.packageLock,
    paths.build.nodeModules,
  ]);
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
        joinPath(paths.build.nodeModules, '.bin', 'tsc'),
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
  const buildPaths = playgroundBuildPaths(playground.path, {
    scope: playground.scope,
    name: playground.name,
    providers: [...playground.providers.values()],
  });
  const files = [
    buildPaths.profile,
    ...buildPaths.maps,
    buildPaths.script,
    buildPaths.packageLock,
    buildPaths.nodeModules,
  ];
  logCb?.(formatShellLog('rimraf', files));

  await Promise.all(files.map(f => rimraf(f)));
}
