import { parseMap, parseProfile } from '@superfaceai/parser';

import { DocumentTypeFlag } from './flags';

export const MAP_EXTENSIONS = ['.suma'];
export const PROFILE_EXTENSIONS = ['.supr'];
export const AST_EXTENSIONS = ['.ast.json'];

export enum DocumentType {
  UNKNOWN = 'unknown',
  MAP = 'map',
  PROFILE = 'profile',
  MAP_AST = 'map.ast',
  PROFILE_AST = 'profile.ast',
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

  for (const astExtension of AST_EXTENSIONS) {
    if (MAP_EXTENSIONS.some(ex => normalizedPath.endsWith(ex + astExtension))) {
      return DocumentType.MAP_AST;
    }
    if (
      PROFILE_EXTENSIONS.some(ex => normalizedPath.endsWith(ex + astExtension))
    ) {
      return DocumentType.PROFILE_AST;
    }
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
