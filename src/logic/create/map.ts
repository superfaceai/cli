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
import { prepareMapTemplate } from '../../templates/prepared-map';
import { loadProfileAst } from './utils';

export async function createMap(
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
  const profileAst = await loadProfileAst(profileFile, { userError });

  // Load provider
  const providerFile = await getProviderFile(
    id.provider,
    { superJson, superJsonPath },
    { userError }
  );
  const provider = assertProviderJson(
    JSON.parse(await readFile(providerFile, { encoding: 'utf-8' }))
  );

  const mapTemplate = prepareMapTemplate(profileAst, provider, id.variant);

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
    logger.success(
      'createMap',
      id.profile.id,
      id.provider,
      filePath,
      options?.station
    );
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

    await OutputStream.writeOnce(
      superJsonPath,
      JSON.stringify(superJson, undefined, 2)
    );
    logger.info('updateSuperJson', superJsonPath);
  }
}
