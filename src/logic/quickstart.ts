import { CLIError } from '@oclif/errors';
import {
  META_FILE,
  NormalizedProviderSettings,
  SuperJson,
} from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { execShell, exists } from '../common/io';
import { LogCallback } from '../common/log';

export async function installSdk(options?: {
  logCb?: LogCallback;
  warnCb?: LogCallback;
}): Promise<void> {
  const result = await execShell(
    `${
      (await exists('yarn.lock')) ? 'yarn add' : 'npm install'
    } @superfaceai/one-sdk`
  );
  if (result.stderr !== '') {
    options?.warnCb?.(
      `Shell command "npm install @superfaceai/one-sdk" responded with: "${result.stderr}"`
    );
  }
  if (result.stdout !== '') {
    options?.logCb?.(result.stdout);
  }
}

export async function getProviders(
  superPath: string
): Promise<Record<string, NormalizedProviderSettings>> {
  const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
  const superJson = loadedResult.match(
    v => v,
    err => {
      throw new CLIError(err);
    }
  );

  return superJson.normalized.providers;
}
