import { ProviderJson, SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { EXTENSIONS } from '../common';
import { exists, readdir, readFile } from '../common/io';
import { LogCallback } from '../common/log';

export async function findLocalProfileSource(
  superJson: SuperJson,
  profile: {
    name: string;
    scope?: string;
    version?: string;
  },
  options?: { logCb?: LogCallback }
): Promise<string | undefined> {
  const profileId = `${profile.scope ?? ''}/${profile.name}${
    profile.version ? `@${profile.version}` : ''
  }`;

  //Check file property
  const profileName = profile.scope
    ? `${profile.scope}/${profile.name}`
    : profile.name;
  const profileSettings = superJson.normalized.profiles[profileName];
  if (profileSettings !== undefined && 'file' in profileSettings) {
    const resolvedPath = superJson.resolvePath(profileSettings.file);
    if (await exists(resolvedPath)) {
      options?.logCb?.(
        `Profile: "${profileId}" found on path: "${resolvedPath}"`
      );

      return readFile(resolvedPath, { encoding: 'utf-8' });
    }
  }

  //try to look in the grid for source file
  const basePath = profile.scope ? joinPath('grid', profile.scope) : 'grid';
  if (profile.version) {
    const path = joinPath(
      basePath,
      `${profile.name}@${profile.version}${EXTENSIONS.profile.source}`
    );
    const resolvedPath = new SuperJson().resolvePath(path);
    if (await exists(resolvedPath)) {
      options?.logCb?.(
        `Profile: "${profileId}" found on path: "${resolvedPath}"`
      );

      return readFile(resolvedPath, { encoding: 'utf-8' });
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
        f => f.includes(profile.name) && f.endsWith(EXTENSIONS.profile.source)
      );
      if (path) {
        const resolvedPath = superJson.resolvePath(joinPath(basePath, path));
        if (await exists(resolvedPath)) {
          options?.logCb?.(
            `Profile: "${profileId}" found on path: "${resolvedPath}"`
          );

          return readFile(resolvedPath, { encoding: 'utf-8' });
        }
      }
    }
  }
  options?.logCb?.(`Profile: "${profileId}" not found locally`);

  return;
}

export async function findLocalMapSource(
  superJson: SuperJson,
  profile: {
    name: string;
    scope?: string;
  },
  provider: string,
  options?: { logCb?: LogCallback }
): Promise<string | undefined> {
  //Check file property
  const profileName = profile.scope
    ? `${profile.scope}/${profile.name}`
    : profile.name;
  const profileSettings = superJson.normalized.profiles[profileName];
  if (profileSettings !== undefined) {
    const profileProviderSettings = profileSettings.providers[provider];
    if (profileProviderSettings && 'file' in profileProviderSettings) {
      const resolvedPath = superJson.resolvePath(profileProviderSettings.file);
      if (await exists(resolvedPath)) {
        options?.logCb?.(
          `Map for profile: "${profileName}" and provider: "${provider}"found on path: "${resolvedPath}"`
        );

        return readFile(resolvedPath, { encoding: 'utf-8' });
      }
    }
  }

  options?.logCb?.(
    `Map for profile: "${profileName}" and provider: "${provider}" not found locally`
  );

  return;
}

export async function findLocalProviderSource(
  superJson: SuperJson,
  provider: string,
  options?: { logCb?: LogCallback }
): Promise<ProviderJson | undefined> {
  //Check file property
  const providerSettings = superJson.normalized.providers[provider];
  if (
    providerSettings !== undefined &&
    'file' in providerSettings &&
    providerSettings.file
  ) {
    const resolvedPath = superJson.resolvePath(providerSettings.file);
    if (await exists(resolvedPath)) {
      options?.logCb?.(
        `Provider: "${provider}" found on path: "${resolvedPath}"`
      );

      return JSON.parse(
        await readFile(resolvedPath, { encoding: 'utf-8' })
      ) as ProviderJson;
    }
  }

  options?.logCb?.(`Provider: "${provider}" not found locally`);

  return;
}
