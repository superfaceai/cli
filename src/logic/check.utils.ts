import { AssertionError, EXTENSIONS, ProviderJson } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { exists, readdir, readFile } from '../common/io';
import { ProfileId } from '../common/profile';

export async function findLocalProfileSource(
  superJson: SuperJson,
  profile: ProfileId,
  version?: string
): Promise<{ path: string; source: string } | undefined> {
  //Check file property
  const profileSettings = superJson.normalized.profiles[profile.id];
  if (profileSettings !== undefined && 'file' in profileSettings) {
    const resolvedPath = superJson.resolvePath(profileSettings.file);
    if (await exists(resolvedPath)) {
      return {
        source: await readFile(resolvedPath, { encoding: 'utf-8' }),
        path: resolvedPath,
      };
    }
  }

  //try to look in the grid for source file
  const basePath = profile.scope ? joinPath('grid', profile.scope) : 'grid';
  if (version) {
    const path = joinPath(
      basePath,
      `${profile.name}@${version}${EXTENSIONS.profile.source}`
    );
    const resolvedPath = superJson.resolvePath(path);
    if (await exists(resolvedPath)) {
      return {
        source: await readFile(resolvedPath, { encoding: 'utf-8' }),
        path: resolvedPath,
      };
    }
  } else {
    //Look for any version
    const scopePath = superJson.resolvePath(basePath);
    if (await exists(scopePath)) {
      //Get files in profile directory
      const files = (await readdir(scopePath, { withFileTypes: true }))
        .filter(dirent => dirent.isFile() || dirent.isSymbolicLink())
        .map(dirent => dirent.name);
      //Find files with similar name to profile and with .ast.json extension
      const path = files.find(
        f =>
          f.startsWith(`${profile.name}@`) &&
          f.endsWith(EXTENSIONS.profile.source)
      );
      if (path) {
        const resolvedPath = superJson.resolvePath(joinPath(basePath, path));
        if (await exists(resolvedPath)) {
          return {
            source: await readFile(resolvedPath, { encoding: 'utf-8' }),
            path: resolvedPath,
          };
        }
      }
    }
  }

  return;
}

export async function findLocalMapSource(
  superJson: SuperJson,
  profile: ProfileId,
  provider: string
): Promise<{ path: string; source: string } | undefined> {
  //Check file property
  const profileSettings = superJson.normalized.profiles[profile.id];
  if (profileSettings !== undefined) {
    const profileProviderSettings = profileSettings.providers[provider];
    if (profileProviderSettings && 'file' in profileProviderSettings) {
      const resolvedPath = superJson.resolvePath(profileProviderSettings.file);
      if (await exists(resolvedPath)) {
        return {
          source: await readFile(resolvedPath, { encoding: 'utf-8' }),
          path: resolvedPath,
        };
      }
    }
  }

  return;
}

export async function findLocalProviderSource(
  superJson: SuperJson,
  provider: string
): Promise<{ path: string; source: ProviderJson } | undefined> {
  //Check file property
  const providerSettings = superJson.normalized.providers[provider];
  if (
    providerSettings !== undefined &&
    'file' in providerSettings &&
    providerSettings.file
  ) {
    const resolvedPath = superJson.resolvePath(providerSettings.file);
    if (await exists(resolvedPath)) {
      return {
        path: resolvedPath,
        source: JSON.parse(
          await readFile(resolvedPath, { encoding: 'utf-8' })
        ) as ProviderJson,
      };
    }
  }

  return;
}

export function isProviderParseError(
  input: unknown
): input is AssertionError {
  return input instanceof AssertionError;
}
