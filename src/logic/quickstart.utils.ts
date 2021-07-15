import { isProfileDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { EXTENSIONS } from '..';
import { userError } from '../common/error';
import { exists, readdir, readFile } from '../common/io';

export async function loadProfileAst(
  superJson: SuperJson,
  profile: { profile: string; scope?: string; version?: string }
): Promise<ProfileDocumentNode | undefined> {
  let astPath: string | undefined = undefined;
  const basePath = profile.scope ? joinPath('grid', profile.scope) : 'grid';
  if (profile.version) {
    const path = joinPath(
      basePath,
      `${profile.profile}@${profile.version}${EXTENSIONS.profile.build}`
    );
    const resolvedPath = superJson.resolvePath(path);
    if (await exists(resolvedPath)) {
      astPath = resolvedPath;
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
        f => f.includes(profile.profile) && f.endsWith(EXTENSIONS.profile.build)
      );
      if (path) {
        const resolvedPath = superJson.resolvePath(joinPath(basePath, path));
        if (await exists(resolvedPath)) astPath = resolvedPath;
      }
    }
  }

  //Check file property
  const profileName = profile.scope
    ? `${profile.scope}/${profile.profile}`
    : profile.profile;
  const profileSettings = superJson.normalized.profiles[profileName];
  if (profileSettings !== undefined && 'file' in profileSettings) {
    const resolvedPath = superJson.resolvePath(profileSettings.file);
    if (await exists(resolvedPath)) {
      astPath = resolvedPath;
    }
  }
  if (!astPath) {
    return;
  }
  const document = (await JSON.parse(
    await readFile(astPath, { encoding: 'utf-8' })
  )) as ProfileDocumentNode;

  if (!isProfileDocumentNode(document)) {
    throw userError(
      `Profile ${profileName}${
        profile.version ? `@${profile.version}` : ''
      } loaded from ${astPath} is not valid ProfileDocumentNode`,
      1
    );
  }

  return document;
}

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
        .filter(dirent => dirent.isFile() || dirent.isSymbolicLink())
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
