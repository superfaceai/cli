import { parseMap, parseProfile } from '@superfaceai/superface-parser';

import { DocumentTypeFlag } from './flags';

export enum DocumentType {
  UNKNOWN = 'unknown',
  MAP = 'map',
  PROFILE = 'profile',
}
/**
 * Detects whether the file on path is Superface Map or Superface Profile based on the extension.
 */
export function inferDocumentType(path: string): DocumentType {
  const MAP_EXTENSIONS = ['.suma', '.map.slang'];
  const PROFILE_EXTENSIONS = ['.supr', '.profile.slang'];

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
