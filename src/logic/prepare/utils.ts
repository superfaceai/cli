import type { ProfileDocumentNode } from '@superfaceai/ast';
import { assertProfileDocumentNode, EXTENSIONS } from '@superfaceai/ast';
import { parseProfile, Source } from '@superfaceai/parser';

import type { UserError } from '../../common/error';
import { readFile } from '../../common/io';

// TODO: move to some AST helper?
export async function loadProfileAst(
  path: string,
  {
    userError,
  }: {
    userError: UserError;
  }
): Promise<ProfileDocumentNode> {
  const source = await readFile(path, { encoding: 'utf-8' });

  let ast: ProfileDocumentNode;
  if (path.endsWith(EXTENSIONS.profile.source)) {
    ast = parseProfile(new Source(source, path));
  } else if (path.endsWith(EXTENSIONS.profile.build)) {
    ast = assertProfileDocumentNode(
      JSON.parse(await readFile(path, { encoding: 'utf-8' }))
    );
  } else {
    throw userError('Unknown profile file extension', 1);
  }

  return assertProfileDocumentNode(ast);
}
