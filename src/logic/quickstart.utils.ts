import type { SuperJsonDocument } from '@superfaceai/ast';
import { EXTENSIONS } from '@superfaceai/ast';
import { normalizeSuperJsonDocument } from '@superfaceai/one-sdk';
import { dirname, join as joinPath, resolve as resolvePath } from 'path';

import { exists, readdir } from '../common/io';
import type { ProfileId } from '../common/profile';

export async function profileExists(
  superJson: SuperJsonDocument,
  superJsonPath: string,
  profile: { id: ProfileId; version?: string }
): Promise<boolean> {
  // Check source file
  // Look for specific version
  if (profile.version !== undefined) {
    const path = joinPath(
      'grid',
      `${profile.id.id}@${profile.version}${EXTENSIONS.profile.source}`
    );
    if (await exists(resolvePath(dirname(superJsonPath), path))) {
      return true;
    }
  } else {
    // Look for any version
    const scopePath = resolvePath(
      dirname(superJsonPath),
      joinPath('grid', profile.id.scope ?? '')
    );

    if (await exists(scopePath)) {
      // Get files in profile directory
      const files = (await readdir(scopePath, { withFileTypes: true }))
        .filter(dirent => dirent.isFile() || dirent.isSymbolicLink())
        .map(dirent => dirent.name);
      // Find files with similar name to profile
      const path = files.find(f => f.includes(profile.id.name));
      if (
        path !== undefined &&
        (await exists(
          resolvePath(
            dirname(superJsonPath),
            joinPath('grid', profile.id.scope ?? '', path)
          )
        ))
      ) {
        return true;
      }
    }
  }

  // Check file property
  const normalized = normalizeSuperJsonDocument(superJson);
  const profileSettings = normalized.profiles[`${profile.id.id}`];
  if (profileSettings !== undefined && 'file' in profileSettings) {
    if (
      await exists(resolvePath(dirname(superJsonPath), profileSettings.file))
    ) {
      return true;
    }
  }

  return false;
}

export function providerExists(
  superJson: SuperJsonDocument,
  provider: string
): boolean {
  // Check source file
  const normalized = normalizeSuperJsonDocument(superJson);
  if (normalized.providers[provider] !== undefined) {
    return true;
  }

  return false;
}
