import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { EXTENSIONS } from '..';
import { exists, readdir } from '../common/io';
import { ProfileId } from '../common/profile';

export async function profileExists(
  superJson: SuperJson,
  profile: { id: ProfileId; version?: string }
): Promise<boolean> {
  //Check source file
  //Look for specific version
  if (profile.version) {
    const path = joinPath(
      'grid',
      `${profile.id.id}@${profile.version}${EXTENSIONS.profile.source}`
    );
    if (await exists(superJson.resolvePath(path))) {
      return true;
    }
  } else {
    //Look for any version
    const scopePath = superJson.resolvePath(
      joinPath('grid', profile.id.scope ?? '')
    );

    if (await exists(scopePath)) {
      //Get files in profile directory
      const files = (await readdir(scopePath, { withFileTypes: true }))
        .filter(dirent => dirent.isFile() || dirent.isSymbolicLink())
        .map(dirent => dirent.name);
      //Find files with similar name to profile
      const path = files.find(f => f.includes(profile.id.name));
      if (
        path &&
        (await exists(
          superJson.resolvePath(joinPath('grid', profile.id.scope ?? '', path))
        ))
      ) {
        return true;
      }
    }
  }

  //Check file property
  const profileSettings = superJson.normalized.profiles[`${profile.id.id}`];
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
