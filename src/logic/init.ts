import { parseProfileId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import {
  BUILD_DIR,
  composeUsecaseName,
  composeVersion,
  EXTENSIONS,
  GRID_DIR,
  META_FILE,
  SUPERFACE_DIR,
  TYPES_DIR,
  validateDocumentName,
} from '../common/document';
import { userError } from '../common/error';
import { mkdir, mkdirQuiet } from '../common/io';
import { formatShellLog } from '../common/log';
import { OutputStream } from '../common/output-stream';
import {
  ProfileSettings,
  ProviderSettings,
  SuperJsonStructure,
} from '../common/super.interfaces';
import * as initTemplate from '../templates/init';
import { createProfile } from './create';

type LogCallback = (message: string) => void;

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
  data: SuperJsonStructure,
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
      () => initTemplate.superJson(data),
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

export const parseProfileIds = (input: string): string[] =>
  input
    .split(' ')
    .filter(p => p.trim() !== '')
    .filter(p => parseProfileId(p).kind !== 'error');

export const parseProviders = (input: string): string[] =>
  input
    .split(' ')
    .filter(i => i.trim() !== '')
    .filter(validateDocumentName);

/**
 * Reconstructs profile ids to correct structure for super.json
 * @param profileIds - list of profile ids
 */
export const constructProfileSettings = (
  profileIds: string[]
): ProfileSettings =>
  profileIds.reduce<ProfileSettings>((acc, profileId) => {
    const profile = parseProfileId(profileId);

    if (profile.kind === 'error') {
      throw userError('Wrong profile Id', 1);
    }

    const { scope, name, version } = profile.value;
    const profileName = scope ? `${scope}/${name}` : name;

    acc[profileName] = {
      version: composeVersion(version),
      file: `file:grid/${profileName}${EXTENSIONS.profile.source}`,
    };

    return acc;
  }, {});

/**
 * Reconstruct providers to correct structure for super.json
 * @param providers - list of providers
 */
export const constructProviderSettings = (
  providers: string[]
): ProviderSettings =>
  providers.reduce<ProviderSettings>((acc, provider) => {
    acc[provider] = {
      auth: {
        token: 'fill-this',
      },
    };

    return acc;
  }, {});

/**
 * Generates profiles based on profiles specified in `init` command.
 *
 * @param path - base path of folder where superface folder structure is initialized
 * @param profileIds - list of profile ids
 * @param logCb - logging function
 */
export async function generateSpecifiedProfiles(
  path: string,
  profileIds: string[],
  logCb?: LogCallback
): Promise<void> {
  for (const profileId of profileIds) {
    const parsedProfile = parseProfileId(profileId);

    if (parsedProfile.kind === 'error') {
      throw userError('Wrong profile Id', 1);
    }

    const { scope, name, version } = parsedProfile.value;
    const profileName = scope ? `${scope}/${name}` : name;

    await createProfile(
      joinPath(path, GRID_DIR),
      { scope, name, version },
      [composeUsecaseName(profileName)],
      'empty',
      { logCb }
    );
  }
}
