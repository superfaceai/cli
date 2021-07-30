import { SuperJson, SuperJsonDocument } from '@superfaceai/one-sdk';
import { parseProfileId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import {
  composeUsecaseName,
  GRID_DIR,
  META_FILE,
  SUPERFACE_DIR,
  TYPES_DIR,
} from '../common/document';
import { userError } from '../common/error';
import { mkdir, mkdirQuiet } from '../common/io';
import { formatShellLog, LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { createProfile } from './create';

/**
 * Initializes superface at the given path.
 *
 * The path is recursively created if it doesn't exist.
 * Inside the path the following structure is generated:
 * ```
 * appPath/
 *   superface/
 *     super.json
 *     grid/
 *     build/
 *     types/
 * ```
 *
 * For convenience, returns SuperJson instance read from the super.json path.
 */
export async function initSuperface(
  appPath: string,
  initialDocument?: SuperJsonDocument,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
    warnCb?: LogCallback;
  }
): Promise<SuperJson> {
  // create the base path
  {
    const created = await mkdir(appPath, { recursive: true });
    if (created) {
      options?.logCb?.(formatShellLog('mkdir', [appPath]));
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

  const superJsonPath = joinPath(superPath, META_FILE);
  {
    const created = await OutputStream.writeIfAbsent(
      superJsonPath,
      () => new SuperJson(initialDocument ?? {}).stringified,
      { force: options?.force }
    );

    if (created) {
      options?.logCb?.(
        formatShellLog("echo '<initial super.json>' >", [superJsonPath])
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

  return SuperJson.load(superJsonPath).then(v => v.unwrap());
}

/**
 * Generates profiles based on profiles specified in `init` command.
 *
 * @param path - base path of folder where superface folder structure is initialized
 * @param profileIds - list of profile ids
 * @param logCb - logging function
 */
export async function generateSpecifiedProfiles(
  path: string,
  superJson: SuperJson,
  profileIds: string[],
  logCb?: LogCallback
): Promise<void> {
  for (const profileId of profileIds) {
    const parsedProfile = parseProfileId(profileId);

    if (parsedProfile.kind === 'error') {
      throw userError('Wrong profile Id', 1);
    }

    const { scope, name, version } = parsedProfile.value;

    await createProfile(
      joinPath(path, GRID_DIR),
      { scope, name, version },
      [composeUsecaseName(name)],
      superJson,
      { logCb }
    );
  }
}
