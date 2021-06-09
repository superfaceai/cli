import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { EXTENSIONS } from '..';
import { exists } from '../common/io';

export async function profileExists(
  superJson: SuperJson,
  profile: { profile: string; scope: string; version: string }
): Promise<boolean> {
  //Check source file
  const path = joinPath(
    'grid',
    `${profile.scope}/${profile.profile}@${profile.version}${EXTENSIONS.profile.source}`
  );
  const sourcePath = superJson.resolvePath(path);

  if (await exists(sourcePath)) {
    return true;
  }
  //Check file property
  const profileSettings =
    superJson.normalized.profiles[`${profile.scope}/${profile.profile}`];
  if (profileSettings !== undefined && 'file' in profileSettings) {
    if (await exists(superJson.resolvePath(profileSettings.file))) {
      return true;
    }
  }

  return false;
}

export function providerExists(
  superJson: SuperJson,
  provider: string
): boolean {
  //Check source file
  if (superJson.normalized.providers[provider]) {
    return true;
  }

  return false;
}
