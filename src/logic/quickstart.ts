import {
  META_FILE,
  NormalizedProviderSettings,
  SuperJson,
} from '@superfaceai/one-sdk';
import { exec } from 'child_process';
import { join as joinPath } from 'path';
import { promisify } from 'util';

import { LogCallback } from '../common/log';

const execShell = promisify(exec);

export async function installSdk(options?: {
  logCb?: LogCallback;
  warnCb?: LogCallback;
}): Promise<void> {
  //TODO: check for yarn/package lock and use yarn/npm - npm/yarn init if we dont find package.json? Wher should we look?

  const result = await execShell('npm install @superfaceai/one-sdk');
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
  superPath: string,
  options?: { logCb?: LogCallback; warnCb?: LogCallback }
): Promise<Record<string, NormalizedProviderSettings>> {
  const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
  const superJson = loadedResult.match(
    v => v,
    err => {
      options?.warnCb?.(err);

      return new SuperJson({});
    }
  );

  return superJson.normalized.providers;
}
