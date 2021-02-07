import { ProfileDocumentNode } from '@superfaceai/ast';
import {
  DocumentVersion,
  parseMap,
  parseProfile,
  Source,
} from '@superfaceai/parser';
import { basename, join as joinPath } from 'path';

import * as initTemplate from '../templates/init';
import {
  CreateMode,
  DocumentType,
  WritingOptions,
} from './document.interfaces';
import { userError } from './error';
import { DocumentTypeFlag } from './flags';
import { OutputStream, readdir, readFile } from './io';
import { SuperJsonStructure } from './super.interfaces';

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

export const SUPERFACE_DIR = 'superface';
export const META_FILE = 'super.json';
export const SUPER_PATH = joinPath(SUPERFACE_DIR, META_FILE);
export const GRID_DIR = joinPath(SUPERFACE_DIR, 'grid');
export const TYPES_DIR = joinPath(SUPERFACE_DIR, 'types');
export const BUILD_DIR = joinPath(SUPERFACE_DIR, 'build');

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
  if (normalizedPath.endsWith(EXTENSIONS.map.build)) {
    return DocumentType.MAP_AST;
  }
  if (normalizedPath.endsWith(EXTENSIONS.profile.build)) {
    return DocumentType.PROFILE_AST;
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
  profilePath: string
): Promise<ProfileDocumentNode> {
  const parseFunction = DOCUMENT_PARSE_FUNCTION[DocumentType.PROFILE];
  const content = await readFile(profilePath, { encoding: 'utf-8' });
  const source = new Source(content, profilePath);

  return parseFunction(source);
}

export function isSuperJson(data: unknown): data is SuperJsonStructure {
  return (
    (data as SuperJsonStructure).profiles !== undefined &&
    (data as SuperJsonStructure).providers !== undefined
  );
}

export async function parseSuperJson(
  superJsonPath: string
): Promise<SuperJsonStructure> {
  const json = JSON.parse(await readFile(superJsonPath, { encoding: 'utf-8' }));

  if (isSuperJson(json)) {
    return json;
  }

  throw userError('Invalid super.json', 1);
}

export async function writeSuperJson(
  superJsonPath: string,
  data: SuperJsonStructure,
  options?: WritingOptions
): Promise<boolean> {
  return await OutputStream.writeIfAbsent(
    superJsonPath,
    initTemplate.superJson(data),
    options
  );
}

export async function writeProfile(
  profilePath: string,
  data: string,
  options?: WritingOptions
): Promise<boolean> {
  return await OutputStream.writeIfAbsent(profilePath, data, options);
}

/**
 * Returns a path without extension.
 */
export function trimExtension(path: string): string {
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
 * Find capability ids in directory given by @param path.
 *
 * If a file is found, check its extension and add it to array of results.
 *
 * If a directory is found, treat it as a scope, look for profiles inside
 * and add them to array of results with corresponding scope.
 *
 */
export async function findLocalCapabilities(
  path: string,
  capability: 'profile' | 'map',
  withVersion = false,
  limit = 2
): Promise<string[]> {
  if (!limit) {
    return [];
  }

  const dirents = await readdir(path, {
    withFileTypes: true,
  });

  const profiles: string[] = [];
  for (const dirent of dirents) {
    if (dirent.isFile()) {
      if (
        dirent.name.endsWith(
          capability === 'profile'
            ? EXTENSIONS.profile.source
            : EXTENSIONS.map.source
        )
      ) {
        const {
          header: { version },
        } = await getProfileDocument(joinPath(path, dirent.name));

        profiles.push(
          withVersion
            ? `${trimExtension(dirent.name)}@${composeVersion(version)}`
            : trimExtension(dirent.name)
        );
      }
    }

    if (dirent.isDirectory()) {
      const profilesInScope = (
        await findLocalCapabilities(
          joinPath(path, dirent.name),
          capability,
          withVersion,
          --limit
        )
      ).map(profile => joinPath(dirent.name, profile));

      profiles.push(...profilesInScope);
    }
  }

  return profiles;
}
