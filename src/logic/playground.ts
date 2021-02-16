import { parseDocumentId } from '@superfaceai/parser';
import { Dirent } from 'fs';
import { basename, join as joinPath, resolve as resolvePath } from 'path';

import Compile from '../commands/compile';
import {
  composeUsecaseName,
  DEFAULT_PROFILE_VERSION,
  DEFAULT_PROFILE_VERSION_STR,
  EXTENSIONS,
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
  isFileQuiet,
  LogCallback,
  mkdir,
  OutputStream,
  readdir,
  readFile,
  realpath,
  resolveSkipFile,
  rimraf,
} from '../common/io';
import { formatShellLog } from '../common/log';
import {
  ProfileProvider,
  ProfileSettings,
  ProviderSettings,
  SuperJsonStructure,
} from '../common/super.interfaces';
import { TemplateType } from '../templates/common';
import * as playgroundTemplate from '../templates/playground';
import { createMap, createProfile, createProviderJson } from './create';
import { BUILD_DIR, initSuperface, META_FILE, SUPERFACE_DIR } from './init';

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
  profilePath: string;
  /**
   * Set of providers that are contained within the playground instance.
   */
  providers: { name: string; mapPath: string }[];
}

const PLAY_DIR = joinPath(SUPERFACE_DIR, 'play');

type PlaygroundPaths = {
  /** Path to the default profile source. */
  defaultProfile: string;
  /** Path to the default map sources. */
  defaultMaps: string[];
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

  const profile = joinPath(buildPath, `${id.name}${EXTENSIONS.profile.build}`);
  const maps = id.providers.map(provider =>
    joinPath(buildPath, `${id.name}.${provider}${EXTENSIONS.map.build}`)
  );
  const script = joinPath(buildPath, `${id.name}${EXTENSIONS.play.build}`);
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
  let sourcesBase = appPath;
  let playPath = joinPath(appPath, PLAY_DIR);
  if (id.scope) {
    sourcesBase = joinPath(sourcesBase, id.scope);
    playPath = joinPath(playPath, id.scope);
  }

  const superfacePath = joinPath(appPath, SUPERFACE_DIR);

  const defaultProfile = joinPath(
    sourcesBase,
    `${id.name}${EXTENSIONS.profile.source}`
  );
  const defaultMaps = id.providers.map(provider =>
    joinPath(sourcesBase, `${id.name}.${provider}${EXTENSIONS.map.source}`)
  );

  const script = joinPath(playPath, `${id.name}${EXTENSIONS.play.source}`);
  const packageJson = joinPath(superfacePath, 'package.json');

  return {
    defaultProfile,
    defaultMaps,
    script,
    packageJson,
    build: playgroundBuildPaths(appPath, id),
  };
}

/**
 * Detects `.play.ts` files inside the play directory and first-level subdirectories.
 *
 * The play directory is `appPath/superface/play`.
 */
async function detectPlayScripts(
  appPath: string
): Promise<{ id: { scope?: string; name: string }; path: string }[]> {
  const playDir = joinPath(appPath, PLAY_DIR);

  const topEntries = await readdir(playDir, { withFileTypes: true });

  const fileParseFn = (basePath: string, entry: Dirent, nested?: boolean) => {
    if (entry.isFile() && entry.name.endsWith('.play.ts')) {
      let maybeId = entry.name.slice(0, entry.name.length - '.play.ts'.length);
      if (nested === true) {
        maybeId = basename(basePath) + '/' + maybeId;
      }

      const result = parseDocumentId(maybeId);
      if (result.kind !== 'error') {
        const id = result.value;
        if (id.version === undefined && id.middle.length === 1) {
          return {
            id: { scope: id.scope, name: id.middle[0] },
            path: joinPath(basePath, entry.name),
          };
        }
      }
    }

    return undefined;
  };

  const results = await Promise.all(
    topEntries.map(async entry => {
      const result = [];

      if (entry.isDirectory()) {
        const subdirPath = joinPath(playDir, entry.name);
        const subEntries = await readdir(subdirPath, { withFileTypes: true });

        for (const subEntry of subEntries) {
          const parseResult = fileParseFn(subdirPath, subEntry, true);
          if (parseResult !== undefined) {
            result.push(parseResult);
          }
        }
      } else {
        const parseResult = fileParseFn(playDir, entry);
        if (parseResult !== undefined) {
          result.push(parseResult);
        }
      }

      return result;
    })
  ).then(arr => arr.reduce((acc, curr) => acc.concat(curr)));

  return results;
}

/**
 * Detects `<scope>/<name>.<provider>.suma` files at the application path.
 */
/*
async function detectPlayMaps(
  appPath: string,
  id: {
    scope?: string;
    name: string;
  }
): Promise<string[]> {
  const dirPath =
    id.scope !== undefined ? joinPath(appPath, id.scope) : appPath;

  const entries = await readdir(dirPath, { withFileTypes: true });

  const nameStart = id.name + '.';
  const providers = entries
    .filter(
      e =>
        e.isFile() &&
        e.name.startsWith(nameStart) &&
        e.name.endsWith(EXTENSIONS.map.source)
    )
    .map(e =>
      e.name.slice(
        nameStart.length,
        e.name.length - EXTENSIONS.profile.source.length
      )
    );

  return providers;
}
*/

/**
 * Detects the existence of a `<scope>/<name>.supr` file at the application path.
 */
/*
async function detectPlayProfile(
  appPath: string,
  id: {
    scope?: string;
    name: string;
  }
): Promise<boolean> {
  const profileFile = id.name + EXTENSIONS.profile.source;

  return isFileQuiet(
    id.scope !== undefined
      ? joinPath(appPath, id.scope, profileFile)
      : joinPath(appPath, profileFile)
  );
}
*/

/**
 * Detects playground at specified directory path or rejects.
 *
 * Looks for `superface/package.json`, `<name>.supr` and corresponding `<name>.<provider>.suma` and `superface/play/<name>.play.ts`.
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

  // check the directory exists
  if (!(await isDirectoryQuiet(realPath))) {
    throw userError('The playground path must be a directory', 32);
  }

  // look for "superface/package.json"
  const packageJsonPath = joinPath(realPath, SUPERFACE_DIR, 'package.json');
  if (!(await isFileQuiet(packageJsonPath))) {
    throw userError(
      `The directory at playground path is not a playground: no "${packageJsonPath}" found`,
      34
    );
  }

  // look for "superface/super.json"
  const superJsonPath = joinPath(realPath, SUPERFACE_DIR, META_FILE);
  if (!(await isFileQuiet(superJsonPath))) {
    throw userError(
      `The directory at playground path is not a playground: no "${superJsonPath}" found`,
      35
    );
  }

  // TODO: use sdk superjson parser/validator
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const superJson: SuperJsonStructure = JSON.parse(
    (await readFile(superJsonPath)).toString()
  );

  const instances: PlaygroundInstance[] = [];

  const playScripts = await detectPlayScripts(realPath);
  for (const playScript of playScripts) {
    const key =
      playScript.id.scope !== undefined
        ? `${playScript.id.scope}/${playScript.id.name}`
        : playScript.id.name;

    const profileSettings = superJson.profiles[key];
    // TODO: extract the parsing into a shared library and implement normalization
    if (
      profileSettings !== undefined &&
      typeof profileSettings === 'object' &&
      profileSettings.file !== undefined &&
      profileSettings.providers !== undefined
    ) {
      const profilePath = resolvePath(
        realPath,
        profileSettings.file.slice('file:'.length)
      );

      const localProviders = [];
      for (const [providerName, providerSettings] of Object.entries(
        profileSettings.providers
      )) {
        if (providerSettings.file !== undefined) {
          const mapPath = resolvePath(
            realPath,
            providerSettings.file.slice('file:'.length)
          );

          localProviders.push({
            name: providerName,
            mapPath,
          });
        }
      }

      if (localProviders.length > 0) {
        instances.push({
          path: realPath,
          scope: playScript.id.scope,
          name: playScript.id.name,
          profilePath,
          providers: localProviders,
        });
      }
    }
  }

  if (instances.length === 0) {
    throw userError(
      'The directory at playground path is not a playground: no providers or play scripts found',
      36
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
  template: TemplateType,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  const paths = playgroundFilePaths(appPath, id);

  const profileProviders: ProfileProvider = {};
  for (let i = 0; i < id.providers.length; i += 1) {
    const key = id.providers[i];
    const file = paths.defaultMaps[i];

    profileProviders[key] = {
      file: 'file:' + file,
    };
  }

  const profileKey = id.scope ? `${id.scope}/${id.name}` : id.name;
  const profiles: ProfileSettings = {
    [profileKey]: {
      file: 'file:' + paths.defaultProfile,
      version: DEFAULT_PROFILE_VERSION_STR,
      providers: profileProviders,
    },
  };

  const providers: ProviderSettings = {};
  id.providers.forEach(
    providerName => (providers[providerName] = { auth: {} })
  );

  // ensure superface is initialized in the directory
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

  const usecases = [composeUsecaseName(id.name)];

  // create appPath/superface/play/scope/name.play.ts
  {
    const created = await OutputStream.writeIfAbsent(
      paths.script,
      () => playgroundTemplate.glueScript(template, usecases[0]),
      { force: options?.force, dirs: true }
    );

    if (created) {
      options?.logCb?.(
        formatShellLog("echo '<play.ts template>' >", [paths.script])
      );
    }
  }

  // appPath/scope/name.supr
  await createProfile(
    appPath,
    {
      scope: id.scope,
      name: id.name,
      version: DEFAULT_PROFILE_VERSION,
    },
    usecases,
    template,
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
      template,
      options
    );

    // appPath/provider.provider.json
    await createProviderJson(appPath, provider, template, options);
  }
}

export async function executePlayground(
  playground: PlaygroundInstance,
  selectedProviders: string[],
  skip: Record<'npm' | 'ast' | 'tsc', SkipFileType>,
  options: {
    debugLevel: string;
    logCb?: LogCallback;
  }
): Promise<void> {
  const providers = playground.providers.filter(p =>
    selectedProviders.includes(p.name)
  );

  const paths = playgroundFilePaths(playground.path, {
    scope: playground.scope,
    name: playground.name,
    providers: selectedProviders, // TODO: Or empty array, this is unused
  });
  await mkdir(paths.build.base, { recursive: true, mode: 0o744 });

  const skipNpm = await resolveSkipFile(skip.npm, [
    paths.build.packageLock,
    paths.build.nodeModules,
  ]);
  if (!skipNpm) {
    const npmInstallPath = joinPath(playground.path, SUPERFACE_DIR);
    options.logCb?.(formatShellLog(`npm install # in ${npmInstallPath}`));
    try {
      await execFile('npm', ['install'], {
        cwd: npmInstallPath,
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
        playground.profilePath,
        ...providers.map(p => p.mapPath),
      ])
    );

    try {
      await Compile.run([
        '--output',
        paths.build.base,
        playground.profilePath,
        ...providers.map(p => p.mapPath),
      ]);
    } catch (err) {
      assertIsGenericError(err);
      throw userError(`superface compilation failed: ${err.message}`, 23);
    }
  }

  const skipTsc = await resolveSkipFile(skip.tsc, [paths.script]);
  if (!skipTsc) {
    const tscPath = joinPath(paths.build.nodeModules, '.bin', 'tsc');
    const typeRootsPath = joinPath(paths.build.nodeModules, '@types');
    options.logCb?.(
      formatShellLog(
        `'${tscPath}' --strict --target ES2015 --module commonjs --outDir '${paths.build.base}' --typeRoots`,
        [typeRootsPath, paths.script]
      )
    );
    try {
      await execFile(
        tscPath,
        [
          '--strict',
          '--target',
          'ES2015',
          '--module',
          'commonjs',
          '--outDir',
          paths.build.base,
          '--typeRoots',
          typeRootsPath,
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
    let playgroundId = playground.name;
    if (playground.scope !== undefined) {
      playgroundId = playground.scope + '/' + playgroundId;
    }
    const scriptArgs = providers.map(
      provider => `${playgroundId}.${provider.name}`
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
    providers: playground.providers.map(p => p.name),
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
