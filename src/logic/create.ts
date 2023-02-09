import type { SuperJsonDocument } from '@superfaceai/ast';
import { EXTENSIONS } from '@superfaceai/ast';
import { mergeProfile, NodeFileSystem } from '@superfaceai/one-sdk';
import type { VersionRange } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import { composeVersion } from '../common/document';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { resolveSuperfaceRelativePath } from '../common/path';
import type { ProfileId } from '../common/profile';
import * as profileTemplate from '../templates/profile';

/**
 * Creates a new profile
 */
export async function createEmptyProfile(
  {
    basePath,
    profile,
    version,
    usecaseNames,
    superJson,
    superJsonPath,
    fileName,
    options,
  }: {
    basePath: string;
    profile: ProfileId;
    version: VersionRange;
    usecaseNames: string[];
    superJson?: SuperJsonDocument;
    superJsonPath?: string;
    fileName?: string;
    options?: {
      force?: boolean;
    };
  },
  { logger }: { logger: ILogger }
): Promise<void> {
  // Add extension if missing
  if (fileName !== undefined && !fileName.endsWith(EXTENSIONS.profile.source)) {
    fileName = fileName + EXTENSIONS.profile.source;
  }
  let filePath = fileName ?? `${profile.id}${EXTENSIONS.profile.source}`;

  const versionStr = composeVersion(version);
  filePath = joinPath(basePath, filePath);

  const created = await OutputStream.writeIfAbsent(
    filePath,
    [
      profileTemplate.header(profile.id, versionStr),
      ...usecaseNames.map(u => profileTemplate.empty(u)),
    ].join(''),
    { force: options?.force, dirs: true }
  );

  if (created) {
    logger.success(
      'createEmptyProfile',
      profile.withVersion(versionStr),
      filePath
    );
    if (superJson !== undefined && superJsonPath !== undefined) {
      mergeProfile(
        superJson,
        profile.id,
        {
          file: resolveSuperfaceRelativePath(superJsonPath, filePath),
        },
        NodeFileSystem
      );
    }
  }
}
