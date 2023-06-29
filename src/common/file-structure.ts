import { join, resolve } from 'path';

export const DEFAULT_SUPERFACE_DIR = 'superface';

const PROFILE_EXTENSION = '.profile';

const PROVIDER_EXTENSION = '.provider.json';

const MAP_EXTENSION = '.map.js';

export function buildSuperfaceDirPath(): string {
  return join(resolve(process.cwd()), DEFAULT_SUPERFACE_DIR);
}

export function buildProfilePath(profileId: string): string {
  return join(
    resolve(process.cwd()),
    DEFAULT_SUPERFACE_DIR,
    `${profileId}${PROFILE_EXTENSION}`
  );
}

export function buildProviderPath(providerName: string): string {
  return join(
    resolve(process.cwd()),
    DEFAULT_SUPERFACE_DIR,
    `${providerName}${PROVIDER_EXTENSION}`
  );
}

export function buildMapPath(profileId: string, providerName: string): string {
  return join(
    resolve(process.cwd()),
    DEFAULT_SUPERFACE_DIR,
    `${profileId}.${providerName}${MAP_EXTENSION}`
  );
}

export function buildAssetsPath(): string {
  return resolve(process.cwd(), DEFAULT_SUPERFACE_DIR);
}

export function buildRunFilePath(
  profileId: string,
  providerName: string,
  language: 'JS' | 'Python'
): string {
  const extension = language === 'JS' ? '.mjs' : '.py';

  return join(
    resolve(process.cwd()),
    DEFAULT_SUPERFACE_DIR,
    `${profileId}.${providerName}${extension}`
  );
}
