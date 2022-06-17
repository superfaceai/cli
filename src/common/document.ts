import {
  DocumentType,
  EXTENSIONS,
  inferDocumentType,
  ProfileEntry,
  ProfileProviderEntry,
  ProviderSettings,
} from '@superfaceai/ast';
import {
  parseMap,
  parseProfile,
  parseProfileId,
  VersionRange,
} from '@superfaceai/parser';
import { basename, join as joinPath } from 'path';

import { UserError } from './error';
import { DocumentTypeFlag } from './flags';

export const DEFAULT_PROFILE_VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
};
export const DEFAULT_PROFILE_VERSION_STR = '1.0.0';
export const UNVERIFIED_PROVIDER_PREFIX = 'unverified-';
export const SF_API_URL_VARIABLE = 'SUPERFACE_API_URL';
export const SF_PRODUCTION = 'https://superface.ai';
export const SUPERFACE_DIR = 'superface';
export const META_FILE = 'super.json';
export const UNCOMPILED_SDK_FILE = 'sdk.ts';
export const SUPER_PATH = joinPath(SUPERFACE_DIR, META_FILE);
export const GRID_DIR = joinPath(SUPERFACE_DIR, 'grid');
export const TYPES_DIR = joinPath(SUPERFACE_DIR, 'types');
export const BUILD_DIR = joinPath(SUPERFACE_DIR, 'build');

/**
 * If flag is `DocumentTypeFlag.UNKNOWN` and `path` is defined, then calls `inferDocumentType(path)`
 * otherwise returns `flag`.
 */
export function inferDocumentTypeWithFlag(
  flag: DocumentTypeFlag,
  path?: string
): DocumentType {
  if (flag === 'map') {
    return DocumentType.MAP;
  }
  if (flag === 'profile') {
    return DocumentType.PROFILE;
  }

  if (path === undefined) {
    return DocumentType.UNKNOWN;
  }

  return inferDocumentType(path);
}

export const DOCUMENT_PARSE_FUNCTION = {
  [DocumentType.MAP]: parseMap,
  [DocumentType.PROFILE]: parseProfile,
};

export function composeVersion(version: VersionRange, forMap = false): string {
  const patch = forMap ? '' : `.${version.patch ?? 0}`;
  const label = version.label ? `-${version.label}` : '';

  return `${version.major}.${version.minor ?? 0}${patch}${label}`;
}

export const composeUsecaseName = (documentId: string): string =>
  documentId
    .split(/[-_]/)
    .filter(w => w.trim() !== '')
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join('');

/**
 * Returns a path without extension.
 */
export function trimExtension(
  path: string,
  { userError }: { userError: UserError }
): string {
  const documentType = inferDocumentType(path);

  switch (documentType) {
    case DocumentType.PROFILE:
      return basename(path, EXTENSIONS.profile.source);
    case DocumentType.MAP:
      return basename(path, EXTENSIONS.map.source);
    case DocumentType.PROFILE_AST:
      return basename(path, EXTENSIONS.profile.build);
    case DocumentType.MAP_AST:
      return basename(path, EXTENSIONS.map.build);
    case DocumentType.UNKNOWN:
      throw userError('Could not infer document type', 3);
  }
}

/**
 * Reconstructs profile ids to correct structure for super.json
 * @param profileIds - list of profile ids
 */
export const constructProfileSettings = (
  profileIds: string[],
  { userError }: { userError: UserError }
): Record<string, ProfileEntry> =>
  profileIds.reduce<Record<string, ProfileEntry>>((acc, profileId) => {
    const profile = parseProfileId(profileId);

    if (profile.kind === 'error') {
      throw userError('Wrong profile Id', 1);
    }

    const { scope, name, version } = profile.value;
    const profileName = scope ? `${scope}/${name}` : name;

    acc[profileName] = {
      version: composeVersion(version),
      file: `grid/${profileName}${EXTENSIONS.profile.source}`,
    };

    return acc;
  }, {});

/**
 * Reconstruct providers next to profile settings
 * @param providers - list of providers
 */
export const constructProfileProviderSettings = (
  providers: {
    providerName: string,
    mapVariant?: string,
  }[]
): Record<string, ProfileProviderEntry> =>
  providers.reduce<Record<string, ProfileProviderEntry>>((acc, provider) => {
    acc[provider.providerName] = provider.mapVariant?{ mapVariant: provider.mapVariant}:{};

    return acc;
  }, {});

/**
 * Reconstruct providers next to profiles in super.json
 * @param providers - list of providers
 */
export const constructProviderSettings = (
  providers: string[]
): Record<string, ProviderSettings> =>
  providers.reduce<Record<string, ProviderSettings>>((acc, provider) => {
    acc[provider] = {};

    return acc;
  }, {});
