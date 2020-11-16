import { flags } from '@oclif/command'
import { IOptionFlag } from '@oclif/command/lib/flags';
import { CLIError } from '@oclif/errors';

import { parseMap, parseProfile } from '@superfaceai/superface-parser';

export type DocumentTypeFlag = 'auto' | 'map' | 'profile';
export const documentTypeFlag: IOptionFlag<DocumentTypeFlag> = flags.build({
  char: 't',
  description: 'Document type to parse. `auto` attempts to infer from file extension.',
  options: ['auto', 'map', 'profile'],
  parse(input, _context) {
    // Sanity check
    if (input !== 'auto' && input !== 'map' && input !== 'profile') {
      throw new CLIError('Internal error: unexpected enum variant', { exit: -1 })
    }

    return input;
  }
})({ default: 'auto' });

export enum DocumentType {
  UNKNOWN = 'unknown',
  MAP = 'map',
  PROFILE = 'profile'
}
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
export function inferDocumentTypeWithFlag(flag: DocumentTypeFlag, path?: string): DocumentType {
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
  [DocumentType.PROFILE]: parseProfile
}