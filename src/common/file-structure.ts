import { join, resolve } from 'path';

const DEFAULT_SUPERFACE_DIR = 'superface';

const PROFILE_EXTENSION = '.profile';

const PROVIDER_EXTENSION = '.provider.json';

const MAP_EXTENSION = '.map.js';

export function buildSuperfaceDirPath(): string {
  return join(resolve(process.cwd()), DEFAULT_SUPERFACE_DIR);
}

export function buildProfilePath(
  scope: string | undefined,
  name: string
): string {
  return join(
    resolve(process.cwd()),
    DEFAULT_SUPERFACE_DIR,
    `${scope !== undefined ? `${scope}.` : ''}${name}${PROFILE_EXTENSION}`
  );
}

export function buildProviderPath(providerName: string): string {
  return join(
    resolve(process.cwd()),
    DEFAULT_SUPERFACE_DIR,
    `${providerName}${PROVIDER_EXTENSION}`
  );
}

export function buildMapPath({
  profileScope,
  profileName,
  providerName,
}: {
  profileScope?: string;
  profileName: string;
  providerName: string;
}): string {
  return join(
    resolve(process.cwd()),
    DEFAULT_SUPERFACE_DIR,
    `${
      profileScope !== undefined ? `${profileScope}.` : ''
    }${profileName}.${providerName}${MAP_EXTENSION}`
  );
}

export function buildRunFilePath({
  profileScope,
  profileName,
  providerName,
  language,
}: {
  profileScope?: string;
  profileName: string;
  providerName: string;
  language: 'JS' | 'Python';
}): string {
  const extension = language === 'JS' ? '.mjs' : '.py';

  return join(
    resolve(process.cwd()),
    DEFAULT_SUPERFACE_DIR,
    `${
      profileScope !== undefined ? `${profileScope}.` : ''
    }${profileName}.${providerName}${extension}`
  );
}

export function buildProjectDefinitionFilePath(
  language: 'JS' | 'Python' = 'JS'
): string {
  if (language === 'Python') {
    throw new Error('Python is not supported yet');
  }
  const file = 'package.json';

  return join(resolve(process.cwd()), DEFAULT_SUPERFACE_DIR, file);
}
