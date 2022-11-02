import { SuperJsonDocument } from '@superfaceai/ast';
import { mergeProvider, NodeFileSystem } from '@superfaceai/one-sdk';

import type { ILogger } from '../../common';
import { OutputStream } from '../../common/output-stream';
import { resolveSuperfaceRelativePath } from '../../common/path';
import * as providerTemplate from '../../templates/provider';
import { selectSecuritySchemas } from './security';

export async function prepareProvider(
  {
    provider,
    superJson,
    superJsonPath,
    options,
  }: {
    provider: string,
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

  // prepare security
  const securitySchemes = await selectSecuritySchemas(provider)

  let filePath: string;
  if (options?.station === true) {
    filePath = `providers/${provider}.json`;
  } else {
    filePath = `${provider}.json`;
  }

  const created = await OutputStream.writeIfAbsent(
    filePath,
    providerTemplate.full(provider, securitySchemes),
    { force: options?.force, dirs: true }
  );



  if (created) {
    logger.success('createProvider', provider, filePath);
    if (superJson && superJsonPath !== undefined) {
      mergeProvider(
        superJson,
        provider,
        {
          file: resolveSuperfaceRelativePath(superJsonPath, filePath),
          security: securitySchemes
        },
        NodeFileSystem
      );
    }
  }
}

