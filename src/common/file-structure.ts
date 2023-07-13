import { join, resolve } from 'path';

import { SupportedLanguages } from '../logic/application-code/application-code';

const DEFAULT_SUPERFACE_DIR = 'superface';

const PROFILE_EXTENSION = '.profile';

const PROVIDER_EXTENSION = '.provider.json';

const MAP_EXTENSION = '.map.js';

export function isInsideSuperfaceDir(): boolean {
  return process.cwd().endsWith('/' + DEFAULT_SUPERFACE_DIR);
}

export function buildSuperfaceDirPath(): string {
  // If user is in superface dir, use it
  if (process.cwd().endsWith('/' + DEFAULT_SUPERFACE_DIR))
    return resolve(process.cwd());

  return join(resolve(process.cwd()), DEFAULT_SUPERFACE_DIR);
}

export function buildProfilePath(
  scope: string | undefined,
  name: string
): string {
  return join(
    buildSuperfaceDirPath(),
    `${scope !== undefined ? `${scope}.` : ''}${name}${PROFILE_EXTENSION}`
  );
}

export function buildProviderPath(providerName: string): string {
  return join(buildSuperfaceDirPath(), `${providerName}${PROVIDER_EXTENSION}`);
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
    buildSuperfaceDirPath(),
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
  language: SupportedLanguages;
}): string {
  const EXTENSION_MAP: { [key in SupportedLanguages]: string } = {
    js: '.mjs',
    python: '.py',
  };

  const extension = EXTENSION_MAP[language];

  return join(
    buildSuperfaceDirPath(),
    `${
      profileScope !== undefined ? `${profileScope}.` : ''
    }${profileName}.${providerName}${extension}`
  );
}

export function buildProjectDefinitionFilePath(
  language: SupportedLanguages = SupportedLanguages.JS
): string {
  const FILENAME_MAP: { [key in SupportedLanguages]: string } = {
    js: 'package.json',
    python: 'requirements.txt',
  };

  return join(buildSuperfaceDirPath(), FILENAME_MAP[language]);
}

export function buildProjectDotenvFilePath(): string {
  return join(buildSuperfaceDirPath(), '.env');
}
