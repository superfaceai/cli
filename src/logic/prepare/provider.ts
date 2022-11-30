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
  const baseUrl = (
    await inquirer.prompt({
      name: 'baseUrl',
      message: `Enter default base url for provider ${provider}. More urls can be added later:`,
      type: 'input',
      default: undefined,
    })
  ).baseUrl;

  // prepare security
  const security = await selectSecuritySchemas(provider);

  // prepare integration parameters
  const parameters = await selectIntegrationParameters(provider);

  const superJosnParameters: Record<string, string> = {};

  parameters.forEach(p => {
    superJosnParameters[p.name] = p.value;
  });

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
      parameters.map(p => ({
        name: p.name,
        default: p.default,
        description: p.description,
      }))
    ),
    { force: options?.force, dirs: true }
  );

  console.log(created, 'sj', superJson, 'path', superJsonPath);

  if (created) {
    logger.success('createProvider', provider, filePath);
    if (superJson && superJsonPath !== undefined) {
      mergeProvider(
        superJson,
        provider,
        {
          file: resolveSuperfaceRelativePath(superJsonPath, filePath),
          security: security.values,
          parameters: superJosnParameters,
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
