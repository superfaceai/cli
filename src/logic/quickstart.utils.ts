import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { EXTENSIONS } from '..';
import { exists, readdir } from '../common/io';

export async function profileExists(
  superJson: SuperJson,
  profile: { profile: string; scope: string; version?: string }
): Promise<boolean> {
  //Check source file
  //Look for specific version
  if (profile.version) {
    const path = joinPath(
      'grid',
      `${profile.scope}/${profile.profile}@${profile.version}${EXTENSIONS.profile.source}`
    );
    if (await exists(superJson.resolvePath(path))) {
      return true;
    }
  } else {
    //Look for any version
    const scopePath = superJson.resolvePath(joinPath('grid', profile.scope));

    if (await exists(scopePath)) {
      //Get files in profile directory
      const files = (await readdir(scopePath, { withFileTypes: true }))
        .filter(dirent => !dirent.isDirectory())
        .map(dirent => dirent.name);
      //Find files with similar name to profile
      const path = files.find(f => f.includes(profile.profile));
      if (
        path &&
        (await exists(
          superJson.resolvePath(joinPath('grid', profile.scope, path))
        ))
      ) {
        return true;
      }
    }
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
