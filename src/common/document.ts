import { parseMap, parseProfile } from '@superfaceai/parser';

import { DocumentTypeFlag } from './flags';

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

export interface DocumentStructure {
  profile: string;
  scope?: string;
  provider?: string;
  variant?: string;
  version: string;
}

/**
 * This regex represents identifiers such as:
 * - profile
 * - scope
 * - provider
 * - variant
 */
const IDENTIFIER_REGEX = /[a-z][a-z0-9_-]*/;
const VERSION_REGEX = /(@[0-9.]*(-[_a-z][-_a-z0-9]*)?)?/;

export function validateInputNames(
  documentStructure: DocumentStructure
): boolean {
  return Object.entries(documentStructure).every(([structureType, value]) => {
    switch (structureType) {
      case 'profile':
      case 'scope':
      case 'provider':
      case 'variant':
        return IDENTIFIER_REGEX.test(value);
      case 'version':
        return VERSION_REGEX.test(value);
      default:
        return false;
    }
  });
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
