import { MapDocumentId, ProfileDocumentId, Source } from '@superfaceai/parser';
import * as nodePath from 'path';

import { DocumentType, DOCUMENT_PARSE_FUNCTION } from '../common/document';
import { readFile } from '../common/io';

export async function getProfileDocument(path: string) {
  const parseFunction = DOCUMENT_PARSE_FUNCTION[DocumentType.PROFILE];
  const content = (await readFile(path)).toString();
  const source = new Source(content, nodePath.basename(path));

  return parseFunction(source);
}

export async function getMapDocument(path: string) {
  const parseFunction = DOCUMENT_PARSE_FUNCTION[DocumentType.MAP];
  const content = (await readFile(path)).toString();
  const source = new Source(content, nodePath.basename(path));

  return parseFunction(source);
}

export async function getProfileHeader(
  path: string
): Promise<ProfileDocumentId> {
  const {
    header: { scope, name, version },
  } = await getProfileDocument(path);

  return {
    scope,
    name,
    version,
  };
}

export async function getMapHeader(path: string): Promise<MapDocumentId> {
  const {
    header: {
      profile: { scope, name, version },
      provider,
      variant,
    },
  } = await getMapDocument(path);

  return {
    scope,
    name,
    version,
    provider,
    variant,
  };
}
