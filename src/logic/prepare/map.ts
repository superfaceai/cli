import type { SuperJsonDocument } from '@superfaceai/ast';
import { assertProviderJson, EXTENSIONS } from '@superfaceai/ast';
import { mergeProfileProvider, NodeFileSystem } from '@superfaceai/one-sdk';

import type { ILogger } from '../../common';
import { getProfileFile, getProviderFile } from '../../common';
import type { UserError } from '../../common/error';
import { readFile } from '../../common/io';
import { OutputStream } from '../../common/output-stream';
import { resolveSuperfaceRelativePath } from '../../common/path';
import type { ProfileId } from '../../common/profile';
import { serializeMap } from '../../templates/prepared-map';
import { loadProfileAst } from './utils';

export async function prepareMap(
  {
    id,
    superJson,
    superJsonPath,
    options,
  }: {
    id: {
      profile: ProfileId;
      provider: string;
      variant?: string;
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

  // Load provider
  const providerFile = await getProviderFile(
    id.provider,
    { superJson, superJsonPath },
    { userError }
  );
  const provider = assertProviderJson(
    JSON.parse(await readFile(providerFile, { encoding: 'utf-8' }))
  );

  const mapTemplate = serializeMap(ast, provider);

  // Write result
  let filePath: string;
  const variantName = id.variant !== undefined ? `.${id.variant}` : '';

  if (options?.station === true) {
    filePath = `grid/${id.profile.id}/maps/${id.provider}${EXTENSIONS.map.source}`;
  } else {
    filePath = `${id.profile.id}.${id.provider}${variantName}${EXTENSIONS.map.source}`;
  }

  const created = await OutputStream.writeIfAbsent(filePath, mapTemplate, {
    force: options?.force,
    dirs: true,
  });

  if (created) {
    logger.success('createMap', id.profile.id, id.provider, filePath);
    // TODO: move this some where
    mergeProfileProvider(
      superJson,
      id.profile.id,
      id.provider,
      {
        file: resolveSuperfaceRelativePath(superJsonPath, filePath),
      },
      NodeFileSystem
    );
  }
}
