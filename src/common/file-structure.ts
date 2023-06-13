import { join, resolve } from 'path';

const DEFAULT_SUPERFACE_DIR = 'superface';

const DEFAULT_CONTEXT_DIR = join(DEFAULT_SUPERFACE_DIR, 'context');

const INDEX_EXTENSION = '.index.json';

const PROFILE_EXTENSION = '.profile';

const CONTEXT_EXTENSION = '.context.json';

const PROVIDER_EXTENSION = '.provider.json';

const MAP_EXTENSION = '.map.js';

export function buildSuperfaceDirPath(): string {
  return join(resolve(process.cwd()), DEFAULT_SUPERFACE_DIR);
}

export function buildContextDirPath(): string {
  return join(resolve(process.cwd()), DEFAULT_CONTEXT_DIR);
}

export function buildProfilePath(profileId: string): string {
  return join(
    resolve(process.cwd()),
    DEFAULT_SUPERFACE_DIR,
    `${profileId}${PROFILE_EXTENSION}`
  );
}

export function buildContextPath(
  profileId: string,
  providerName: string
): string {
  return join(
    resolve(process.cwd()),
    DEFAULT_CONTEXT_DIR,
    `${profileId}.${providerName}${CONTEXT_EXTENSION}`
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

export function buildIndexPath(providerName: string): string {
  return join(
    resolve(process.cwd()),
    DEFAULT_CONTEXT_DIR,
    `${providerName}${INDEX_EXTENSION}`
  );
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
