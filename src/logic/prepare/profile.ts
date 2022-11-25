import type { SuperJsonDocument } from '@superfaceai/ast';
import { EXTENSIONS } from '@superfaceai/ast';
import { mergeProfile, NodeFileSystem } from '@superfaceai/one-sdk';

import type { ILogger } from '../../common';
import { OutputStream } from '../../common/output-stream';
import { resolveSuperfaceRelativePath } from '../../common/path';
import type { ProfileId } from '../../common/profile';
import * as profileTemplate from '../../templates/profile';

export async function prepareProfile(
  {
    id,
    usecaseNames,
    superJson,
    superJsonPath,
    options,
  }: {
    id: {
      profile: ProfileId;
      version: string;
    };
    usecaseNames: string[];
    superJson: SuperJsonDocument;
    superJsonPath: string;
    options?: {
      force?: boolean;
      station?: boolean;
    };
  },
  // TODO: add deps for FileSystem
  { logger }: { logger: ILogger }
): Promise<void> {
  const content = [
    profileTemplate.header(id.profile.id, id.version),
    ...usecaseNames.map(u => profileTemplate.withInputs(u)),
  ].join('');

  // Write result
  let filePath: string;
  if (options?.station === true) {
    filePath = `grid/${id.profile.id}/profile${EXTENSIONS.profile.source}`;
  } else {
    filePath = `${id.profile.id}${EXTENSIONS.profile.source}`;
  }

  const created = await OutputStream.writeIfAbsent(filePath, content, {
    force: options?.force,
    dirs: true,
  });

  if (created) {
    logger.success('createProfile', id.profile.id, filePath);
    mergeProfile(
      superJson,
      id.profile.id,
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
