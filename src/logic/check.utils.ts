import {
  assertProfileDocumentNode,
  EXTENSIONS,
  ProfileDocumentNode,
  ProviderJson,
  SuperJsonDocument,
} from '@superfaceai/ast';
import { normalizeSuperJsonDocument } from '@superfaceai/one-sdk';
import { dirname, join as joinPath, resolve as resolvePath } from 'path';

import { exists, readdir, readFile } from '../common/io';
import { ProfileId } from '../common/profile';

export async function findLocalProfileAst(
  superJson: SuperJsonDocument,
  superJsonPath: string,
  profile: ProfileId,
  version?: string
): Promise<{ path: string; ast: ProfileDocumentNode } | undefined> {
  //Check file property
  const normalized = normalizeSuperJsonDocument(superJson);
  const profileSettings = normalized.profiles[profile.id];
  if (profileSettings !== undefined && 'file' in profileSettings) {
    const path = profileSettings.file.endsWith(EXTENSIONS.profile.source)
      ? profileSettings.file.replace(
          EXTENSIONS.profile.source,
          EXTENSIONS.profile.build
        )
      : profileSettings.file;
    const resolvedPath = resolvePath(dirname(superJsonPath), path);
    if (await exists(resolvedPath)) {
      return {
        ast: assertProfileDocumentNode(
          JSON.parse(await readFile(resolvedPath, { encoding: 'utf-8' }))
        ),
        path: resolvedPath,
      };
    }
  }

  //try to look in the cache file
  const cachePath = joinPath(
    process.cwd(),
    'node_modules',
    '.cache',
    'superface',
    'profiles'
  );
  const basePath = profile.scope
    ? joinPath(cachePath, profile.scope)
    : cachePath;

  //use passed version or version from super.json
  const superJsonVersion =
    profileSettings !== undefined && 'version' in profileSettings
      ? profileSettings.version
      : undefined;
  const resolvedVersion = version ?? superJsonVersion;
  if (resolvedVersion) {
    const path = joinPath(
      basePath,
      `${profile.name}@${resolvedVersion}${EXTENSIONS.profile.build}`
    );
    const resolvedPath = resolvePath(dirname(superJsonPath), path);
    if (await exists(resolvedPath)) {
      return {
        ast: assertProfileDocumentNode(
          JSON.parse(await readFile(resolvedPath, { encoding: 'utf-8' }))
        ),
        path: resolvedPath,
      };
    }
  }

  return;
}

export async function findLocalProfileSource(
  superJson: SuperJsonDocument,
  superJsonPath: string,
  profile: ProfileId,
  version?: string
): Promise<{ path: string; source: string } | undefined> {
  //Check file property
  const normalized = normalizeSuperJsonDocument(superJson);
  const profileSettings = normalized.profiles[profile.id];
  if (profileSettings !== undefined && 'file' in profileSettings) {
    const resolvedPath = resolvePath(
      dirname(superJsonPath),
      profileSettings.file
    );
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
    const resolvedPath = resolvePath(dirname(superJsonPath), path);
    if (await exists(resolvedPath)) {
      return {
        source: await readFile(resolvedPath, { encoding: 'utf-8' }),
        path: resolvedPath,
      };
    }
  } else {
    //Look for any version
    const scopePath = resolvePath(dirname(superJsonPath), basePath);
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
        const resolvedPath = resolvePath(
          dirname(superJsonPath),
          joinPath(basePath, path)
        );
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
  superJson: SuperJsonDocument,
  superJsonPath: string,
  profile: ProfileId,
  provider: string
): Promise<{ path: string; source: string } | undefined> {
  const normalized = normalizeSuperJsonDocument(superJson);
  //Check file property
  const profileSettings = normalized.profiles[profile.id];
  if (profileSettings !== undefined) {
    const profileProviderSettings = profileSettings.providers[provider];
    if (profileProviderSettings && 'file' in profileProviderSettings) {
      const resolvedPath = resolvePath(
        dirname(superJsonPath),
        profileProviderSettings.file
      );
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
  superJson: SuperJsonDocument,
  superJsonPath: string,
  provider: string
): Promise<{ path: string; source: ProviderJson } | undefined> {
  const normalized = normalizeSuperJsonDocument(superJson);
  //Check file property
  const providerSettings = normalized.providers[provider];
  if (
    providerSettings !== undefined &&
    'file' in providerSettings &&
    providerSettings.file
  ) {
    const resolvedPath = resolvePath(
      dirname(superJsonPath),
      providerSettings.file
    );
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
  input: Record<string, unknown>
): input is { errors: [message: string, path: string[]][] } {
  // return 'path' in input && 'message' in input;
  return 'errors' in input && Array.isArray(input.errors);
}
