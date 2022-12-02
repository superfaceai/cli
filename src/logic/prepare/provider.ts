import type { SuperJsonDocument } from '@superfaceai/ast';
import { mergeProvider, NodeFileSystem } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';

import type { ILogger } from '../../common';
import { OutputStream } from '../../common/output-stream';
import { resolveSuperfaceRelativePath } from '../../common/path';
import * as providerTemplate from '../../templates/provider';
import { selectIntegrationParameters } from './parameters';
import { selectSecuritySchemas } from './security';

export async function prepareProvider(
  {
    provider,
    superJson,
    superJsonPath,
    options,
  }: {
    provider: string;
    superJson: SuperJsonDocument;
    superJsonPath: string;
    options?: {
      force?: boolean;
      station?: boolean;
    };
  },
  { logger }: { logger: ILogger }
): Promise<void> {
  // prepare base url
  const passedUrl = (
    await inquirer.prompt({
      name: 'baseUrl',
      message: `Enter default base url for provider ${provider}. More urls can be added later:`,
      type: 'input',
      default: undefined,
    })
  ).baseUrl;

  let baseUrl: string;
  try {
    baseUrl = new URL(passedUrl).href;
  } catch (error) {
    throw error;
  }

  // prepare security
  const security = await selectSecuritySchemas(provider);

  // prepare integration parameters
  const parameters = await selectIntegrationParameters(provider);

  let filePath: string;
  if (options?.station === true) {
    filePath = `providers/${provider}.json`;
  } else {
    filePath = `${provider}.json`;
  }

  const created = await OutputStream.writeIfAbsent(
    filePath,
    providerTemplate.full(
      provider,
      baseUrl,
      security.schemes,
      parameters.parameters
    ),
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
          security: security.values,
          parameters: parameters.values,
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
}
