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

export function isProfile(
  documentType: DocumentType
): documentType is DocumentType.PROFILE {
  return documentType === DocumentType.PROFILE;
}

export function isMap(
  documentType: DocumentType
): documentType is DocumentType.MAP {
  return documentType === DocumentType.MAP;
}

export function isUnknown(
  documentType: DocumentType
): documentType is DocumentType.UNKNOWN {
  return documentType === DocumentType.UNKNOWN;
}

export function isProfileFile(file: string): file is DocumentType.PROFILE {
  return isProfile(inferDocumentType(file));
}

export function isMapFile(file: string): file is DocumentType.MAP {
  return isMap(inferDocumentType(file));
}

export function isUnknownFile(file: string): file is DocumentType.UNKNOWN {
  return isUnknown(inferDocumentType(file));
}
