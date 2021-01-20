import { DocumentVersion, parseMap, parseProfile } from '@superfaceai/parser';

import { DocumentTypeFlag } from './flags';

export const DEFAULT_PROFILE_VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
};
export const DEFAULT_PROFILE_VERSION_STR = '1.0.0';
export const MAP_EXTENSIONS = ['.suma'];
export const PROFILE_EXTENSIONS = ['.supr'];

export enum DocumentType {
  UNKNOWN = 'unknown',
  MAP = 'map',
  PROFILE = 'profile',
}

/**
 * Detects whether the file on path is Superface Map or Superface Profile based on the extension.
 */
export function inferDocumentType(path: string): DocumentType {
  const normalizedPath = path.toLowerCase().trim();
  if (MAP_EXTENSIONS.some(ex => normalizedPath.endsWith(ex))) {
    return DocumentType.MAP;
  }
  if (PROFILE_EXTENSIONS.some(ex => normalizedPath.endsWith(ex))) {
    return DocumentType.PROFILE;
  }

  return DocumentType.UNKNOWN;
}

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

export function validateDocumentName(name: string): boolean {
  return /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(name);
}

export enum CreateMode {
  PROFILE = 'profile',
  MAP = 'map',
  BOTH = 'both',
  UNKNOWN = 'unknown',
}

export function inferCreateMode(value: string): CreateMode {
  return value === 'profile'
    ? CreateMode.PROFILE
    : value === 'map'
    ? CreateMode.MAP
    : CreateMode.UNKNOWN;
}

export interface VersionStructure {
  major: number;
  minor: number;
  patch: number;
  label?: string;
}

export interface ProviderStructure {
  name: string;
  deployments: {
    id: string;
    baseUrl: string;
  }[];
  security?: {
    auth: {
      [authType: string]: {
        type: string;
        scheme: string;
      };
    };
    hosts: string[];
  }[];
}

export function composeVersion(
  version: DocumentVersion,
  forMap = false
): string {
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
