import { ProfileDocumentNode } from '@superfaceai/ast';
import { DocumentVersion, parseMap, parseProfile, Source } from '@superfaceai/parser';

import { CreateMode, DocumentType } from './document.interfaces';
import { DocumentTypeFlag } from './flags';
import { readFile } from './io';

export const DEFAULT_PROFILE_VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
};
export const DEFAULT_PROFILE_VERSION_STR = '1.0.0';

export const EXTENSIONS = {
  profile: {
    source: '.supr',
    build: '.supr.ast.json',
  },
  map: {
    source: '.suma',
    build: '.suma.ast.json',
  },
  play: {
    source: '.play.ts',
    build: '.play.js',
  },
};

/**
 * Detects whether the file on path is Superface Map or Superface Profile based on the extension.
 */
export function inferDocumentType(path: string): DocumentType {
  const normalizedPath = path.toLowerCase().trim();
  if (normalizedPath.endsWith(EXTENSIONS.map.source)) {
    return DocumentType.MAP;
  }
  if (normalizedPath.endsWith(EXTENSIONS.profile.source)) {
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

export function inferCreateMode(value: string): CreateMode {
  return value === 'profile'
    ? CreateMode.PROFILE
    : value === 'map'
    ? CreateMode.MAP
    : CreateMode.UNKNOWN;
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

export async function getProfileDocument(
  path: string
): Promise<ProfileDocumentNode> {
  const parseFunction = DOCUMENT_PARSE_FUNCTION[DocumentType.PROFILE];
  const content = (await readFile(path)).toString();
  const source = new Source(content, path);

  return parseFunction(source);
}
