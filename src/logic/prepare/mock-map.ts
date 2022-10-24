import type { SuperJsonDocument } from '@superfaceai/ast';
import { EXTENSIONS } from '@superfaceai/ast';
import { mergeProfileProvider, NodeFileSystem } from '@superfaceai/one-sdk';

import type { ILogger } from '../../common';
import { getProfileFile } from '../../common';
import type { UserError } from '../../common/error';
import { OutputStream } from '../../common/output-stream';
import { resolveSuperfaceRelativePath } from '../../common/path';
import type { ProfileId } from '../../common/profile';
import { serializeMockMap } from '../../templates/prepared-map';
import { loadProfileAst } from './utils';

export async function prepareMockMap(
  {
    id,
    superJson,
    superJsonPath,
    options,
  }: {
    id: {
      profile: ProfileId;
      provider?: string;
    };
    superJson: SuperJsonDocument;
    superJsonPath: string;
    options?: {
      force?: boolean;
      station?: boolean;
    };
  },
  // TODO: add deps for FileSystem
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<void> {
  // Load profile
  const profileFile = await getProfileFile(
    id.profile,
    { superJson, superJsonPath },
    { userError }
  );
  const ast = await loadProfileAst(profileFile, { userError });

  const mockMapTemplate = serializeMockMap(ast);

  // Write result
  let filePath: string;

  if (options?.station === true) {
    filePath = `grid/${id.profile.id}/maps/${id.provider ?? 'mock'}${
      EXTENSIONS.map.source
    }`;
  } else {
    filePath = `${id.profile.id}.${id.provider ?? 'mock'}${
      EXTENSIONS.map.source
    }`;
  }

  const created = await OutputStream.writeIfAbsent(filePath, mockMapTemplate, {
    force: options?.force,
    dirs: true,
  });

  if (created) {
    logger.success('createMap', id.profile.id, id.provider ?? 'mock', filePath);
    // TODO: move this some where
    mergeProfileProvider(
      superJson,
      id.profile.id,
      id.provider ?? 'mock',
      {
        file: resolveSuperfaceRelativePath(superJsonPath, filePath),
      },
      NodeFileSystem
    );
  }
}
