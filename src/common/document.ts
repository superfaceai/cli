import {
  parseMap,
  ParseMapIdResult,
  parseProfile,
  ParseProfileIdResult,
} from '@superfaceai/parser';

import { DocumentTypeFlag } from './flags';

export const DEFAULT_PROFILE_VERSION = '1.0.0';
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

export interface DocumentStructure {
  name: string;
  scope?: string;
  provider?: string;
  variant?: string;
  version: VersionStructure;
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

export function isMapParsed(
  result: ParseProfileIdResult | ParseMapIdResult
): result is ParseMapIdResult {
  return 'provider' in result;
}

export function composeStructure(
  result: Exclude<
    ParseProfileIdResult | ParseMapIdResult,
    { kind: 'error'; message: string }
  >
): DocumentStructure {
  return {
    name: result.name,
    scope: result.scope,
    provider: isMapParsed(result) ? result.provider : undefined,
    variant: isMapParsed(result) ? result.variant : undefined,
    version: result.version ?? {
      major: 1,
      minor: 0,
      patch: 0,
    },
  };
}

export function composeVersion(version: VersionStructure): string {
  return (
    `${version.major}.${version.minor}.${version.patch}` +
    (version.label ? `-${version.label}` : '')
  );
}
