import type { SuperJsonDocument } from '@superfaceai/ast';
import {
  loadSuperJson as tryToLoadSuperJson,
  META_FILE,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import { dirname, join as joinPath, resolve as resolvePath } from 'path';

import { detectSuperJson } from '../logic/install';
import type { UserError } from './error';
import { exists } from './io';
import type { ProfileId } from './profile';

export async function loadSuperJson({
  scan,
  userError,
}: {
  scan?: number;
  userError: UserError;
}): Promise<{ superJson: SuperJsonDocument; superJsonPath: string }> {
  const superPath = await detectSuperJson(process.cwd(), scan);
  if (superPath === undefined) {
    throw userError('Unable to lint, super.json not found', 1);
  }
  const superJsonPath = joinPath(superPath, META_FILE);
  const loadedResult = await tryToLoadSuperJson(superJsonPath, NodeFileSystem);
  if (loadedResult.isErr()) {
    throw userError(
      `Unable to load super.json: ${loadedResult.error.formatShort()}`,
      1
    );
  }

  return { superJsonPath, superJson: loadedResult.value };
}

export async function getProfileFile(
  id: ProfileId,
  {
    superJson,
    superJsonPath,
  }: { superJson: SuperJsonDocument; superJsonPath: string },
  { userError }: { userError: UserError }
): Promise<string> {
  const normalized = normalizeSuperJsonDocument(superJson);
  const profileSettings = normalized.profiles[id.id];

  if (profileSettings === undefined) {
    throw userError(`Profile: "${id.id}" not found in super.json`, 1);
  }

  if (!('file' in profileSettings)) {
    throw userError('Profile is not local', 1);
  }
  const file = resolvePath(dirname(superJsonPath), profileSettings.file);

  if (!(await exists(file))) {
    throw userError(`Profile file: "${file}" does not exist`, 1);
  }

  return file;
}

export async function getProviderFile(
  name: string,
  {
    superJson,
    superJsonPath,
  }: { superJson: SuperJsonDocument; superJsonPath: string },
  { userError }: { userError: UserError }
): Promise<string> {
  const normalized = normalizeSuperJsonDocument(superJson);
  const providerSettings = normalized.providers[name];

  if (providerSettings === undefined) {
    throw userError(`Provider: "${name}" not found in super.json`, 1);
  }

  if (!('file' in providerSettings) || providerSettings.file === undefined) {
    throw userError('Provider is not local', 1);
  }
  const file = resolvePath(dirname(superJsonPath), providerSettings.file);

  if (!(await exists(file))) {
    throw userError(`Provider file: "${file}" does not exist`, 1);
  }

  return file;
}
