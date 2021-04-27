import { SuperJson } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { Dirent } from 'fs';
import { basename, join as joinPath } from 'path';

import Compile from '../commands/compile';
import {
  BUILD_DIR,
  composeUsecaseName,
  DEFAULT_PROFILE_VERSION,
  EXTENSIONS,
  META_FILE,
  SUPERFACE_DIR,
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
  mkdir,
  readdir,
  realpath,
  resolveSkipFile,
  rimraf,
} from '../common/io';
import { formatShellLog, LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { TemplateType } from '../templates/common';
import * as playgroundTemplate from '../templates/playground';
import { createMap, createProfile, createProviderJson } from './create';
import { initSuperface } from './init';

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
    maps: { name: string; mapPath: string }[];
    /** Transpiled play script */
    script: string;
    nodeModules: string;
    packageLock: string;
  };
};

/** Returns paths for build artifacts for given playground. */
function playgroundBuildPaths(
  playground: PlaygroundInstance
): PlaygroundPaths['build'] {
  const superfacePath = joinPath(playground.path, SUPERFACE_DIR);

  let buildPath = joinPath(playground.path, BUILD_DIR);
  if (playground.scope) {
    buildPath = joinPath(buildPath, playground.scope);
  }

  const profile =
    playground.profilePath.slice(
      0,
      playground.profilePath.length - EXTENSIONS.profile.source.length
    ) + EXTENSIONS.profile.build;
  const maps = playground.providers.map(p => {
    return {
      name: p.name,
      mapPath:
        p.mapPath.slice(0, p.mapPath.length - EXTENSIONS.map.source.length) +
        EXTENSIONS.map.build,
    };
  });

  const script = joinPath(
    buildPath,
    `${playground.name}${EXTENSIONS.play.build}`
  );
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
function playgroundFilePaths(playground: PlaygroundInstance): PlaygroundPaths {
  let sourcesBase = playground.path;
  let playPath = joinPath(sourcesBase, PLAY_DIR);
  if (playground.scope) {
    sourcesBase = joinPath(sourcesBase, playground.scope);
    playPath = joinPath(playPath, playground.scope);
  }

  const superfacePath = joinPath(playground.path, SUPERFACE_DIR);

  const defaultProfile = joinPath(
    sourcesBase,
    `${playground.name}${EXTENSIONS.profile.source}`
  );
  const defaultMaps = playground.providers.map(provider =>
    joinPath(
      sourcesBase,
      `${playground.name}.${provider.name}${EXTENSIONS.map.source}`
    )
  );

  const script = joinPath(
    playPath,
    `${playground.name}${EXTENSIONS.play.source}`
  );
  const packageJson = joinPath(superfacePath, 'package.json');

  return {
    defaultProfile,
    defaultMaps,
    script,
    packageJson,
    build: playgroundBuildPaths(playground),
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

  const superJson = (await SuperJson.load(superJsonPath)).unwrap();
  const instances: PlaygroundInstance[] = [];

  const playScripts = await detectPlayScripts(realPath);
  if (playScripts.length === 0) {
    throw userError(
      'The directory at playground path is not a playground: no play scripts found',
      36
    );
  }

  for (const playScript of playScripts) {
    const key =
      playScript.id.scope !== undefined
        ? `${playScript.id.scope}/${playScript.id.name}`
        : playScript.id.name;

    const profileSettings = superJson.normalized.profiles[key];
    if (profileSettings !== undefined && 'file' in profileSettings) {
      const profilePath = superJson.resolvePath(profileSettings.file);

      const localProviders = [];
      for (const [providerName, profileProviderSettings] of Object.entries(
        profileSettings.providers
      )) {
        if ('file' in profileProviderSettings) {
          const mapPath = superJson.resolvePath(profileProviderSettings.file);

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
      'The directory at playground path is not a playground: no local profile-provider pairs found in super.json',
      37
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
  const paths = playgroundFilePaths({
    path: appPath,
    scope: id.scope,
    name: id.name,
    profilePath: '',
    providers: id.providers.map(p => ({ name: p, mapPath: '' })),
  });

  // ensure superface is initialized in the directory
  const superJson = await initSuperface(appPath, {}, options);

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
    superJson,
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
      superJson,
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
    await createProviderJson(appPath, superJson, provider, template, options);
  }

  await OutputStream.writeOnce(superJson.path, superJson.stringified);
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
  const paths = playgroundFilePaths(playground);

  const providers = playground.providers.filter(p =>
    selectedProviders.includes(p.name)
  );
  const selectedProvidersMapPaths = playground.providers
    .filter(p => selectedProviders.includes(p.name))
    .map(p => p.mapPath);

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

  const skipAst = await resolveSkipFile(
    skip.ast,
    selectedProvidersMapPaths.map(mapPath =>
      mapPath.replace(EXTENSIONS.map.source, EXTENSIONS.map.build)
    )
  );
  if (!skipAst) {
    options.logCb?.(
      formatShellLog('superface compile', [
        playground.profilePath,
        ...selectedProvidersMapPaths,
      ])
    );

    try {
      await Compile.run([playground.profilePath, ...selectedProvidersMapPaths]);
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
        `'${tscPath}' --strict --target ES2015 --module commonjs --typeRoots`,
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
  const buildPaths = playgroundBuildPaths(playground);
  const files = [
    buildPaths.profile,
    ...buildPaths.maps.map(p => p.mapPath),
    buildPaths.script,
    buildPaths.packageLock,
    buildPaths.nodeModules,
  ];
  logCb?.(formatShellLog('rimraf', files));

  await Promise.all(files.map(f => rimraf(f)));
}
