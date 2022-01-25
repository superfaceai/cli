import { SuperJsonDocument } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { parseProfileId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import {
  composeUsecaseName,
  GRID_DIR,
  META_FILE,
  SUPERFACE_DIR,
  TYPES_DIR,
} from '../common/document';
import { UserError } from '../common/error';
import { mkdir, mkdirQuiet } from '../common/io';
import { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
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
  {
    appPath,
    initialDocument,
    options,
  }: {
    appPath: string;
    initialDocument?: SuperJsonDocument;
    options?: {
      force?: boolean;
    };
  },
  { logger }: { logger: ILogger }
): Promise<SuperJson> {
  // create the base path
  {
    const created = await mkdir(appPath, { recursive: true });
    if (created) {
      logger.info('mkdir', appPath);
    }
  }

  // create superface folder and super.json
  const superPath = joinPath(appPath, SUPERFACE_DIR);
  {
    const created = await mkdirQuiet(superPath);
    if (created) {
      logger.info('mkdir', superPath);
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
      logger.info('initSuperJson', superJsonPath);
    }
  }

  // create subdirs
  {
    const gridPath = joinPath(appPath, GRID_DIR);
    const created = await mkdirQuiet(gridPath);
    if (created) {
      logger.info('mkdir', gridPath);
    }
  }
  {
    const typesPath = joinPath(appPath, TYPES_DIR);
    const created = await mkdirQuiet(typesPath);
    if (created) {
      logger.info('mkdir', typesPath);
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
  {
    path,
    superJson,
    profileIds,
  }: {
    path: string;
    superJson: SuperJson;
    profileIds: string[];
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<void> {
  for (const profileId of profileIds) {
    const parsedProfile = parseProfileId(profileId);

    if (parsedProfile.kind === 'error') {
      throw userError('Wrong profile Id', 1);
    }

    const { scope, name, version } = parsedProfile.value;

    await createProfile(
      {
        basePath: joinPath(path, GRID_DIR),
        profile: ProfileId.fromScopeName(scope, name),
        version,
        usecaseNames: [composeUsecaseName(name)],
        superJson,
      },
      { logger }
    );
  }
}
