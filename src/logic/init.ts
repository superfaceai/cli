import { join as joinPath } from 'path';

import { mkdir, mkdirQuiet, OutputStream } from '../common/io';
import { formatShellLog } from '../common/log';
import { ProfileSettings, ProviderSettings } from '../common/super.interfaces';
import * as initTemplate from '../templates/init';

type LogCallback = (message: string) => void;
export const SUPERFACE_DIR = 'superface';
export const GRID_DIR = joinPath(SUPERFACE_DIR, 'grid');
export const TYPES_DIR = joinPath(SUPERFACE_DIR, 'types');
export const BUILD_DIR = joinPath(SUPERFACE_DIR, 'build');
export const META_FILE = 'super.json';

/**
 * Initializes superface at the given path.
 *
 * The path is recursively created if it doesn't exist.
 * Inside the path the following structure is generated:
 * ```
 * appPath/
 *   .npmrc
 *   superface/
 *     super.json
 *     .gitignore
 *     grid/
 *     build/
 *     types/
 * ```
 */
export async function initSuperface(
  appPath: string,
  profiles: ProfileSettings,
  providers: ProviderSettings,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  // create the base path
  {
    const created = await mkdir(appPath, { recursive: true });
    if (created) {
      options?.logCb?.(formatShellLog('mkdir', [appPath]));
    }
  }

  // TODO: This will not be needed once we migrate
  // to npm repository (since it is the default)
  {
    const npmrcPath = joinPath(appPath, '.npmrc');
    const created = await OutputStream.writeIfAbsent(
      npmrcPath,
      initTemplate.npmRc,
      { force: options?.force }
    );

    if (created) {
      options?.logCb?.(
        formatShellLog("echo '<.npmrc template>' >", [npmrcPath])
      );
    }
  }

  // create superface folder and super.json
  const superPath = joinPath(appPath, SUPERFACE_DIR);
  {
    const created = await mkdirQuiet(superPath);
    if (created) {
      options?.logCb?.(formatShellLog('mkdir', [superPath]));
    }
  }

  {
    const superJsonPath = joinPath(superPath, META_FILE);
    const created = await OutputStream.writeIfAbsent(
      superJsonPath,
      () => initTemplate.superJson(profiles, providers),
      { force: options?.force }
    );

    if (created) {
      options?.logCb?.(
        formatShellLog("echo '<super.json template>' >", [superJsonPath])
      );
    }
  }

  {
    const gitignorePath = joinPath(superPath, '.gitignore');
    const created = await OutputStream.writeIfAbsent(
      gitignorePath,
      initTemplate.gitignore,
      { force: options?.force }
    );

    if (created) {
      options?.logCb?.(
        formatShellLog("echo '<.gitignore template>' >", [gitignorePath])
      );
    }
  }

  // create subdirs
  {
    const gridPath = joinPath(appPath, GRID_DIR);
    const created = await mkdirQuiet(gridPath);
    if (created) {
      options?.logCb?.(formatShellLog('mkdir', [gridPath]));
    }
  }
  {
    const typesPath = joinPath(appPath, TYPES_DIR);
    const created = await mkdirQuiet(typesPath);
    if (created) {
      options?.logCb?.(formatShellLog('mkdir', [typesPath]));
    }
  }
  {
    const buildPath = joinPath(appPath, BUILD_DIR);
    const created = await mkdirQuiet(buildPath);
    if (created) {
      options?.logCb?.(formatShellLog('mkdir', [buildPath]));
    }
  }
}
