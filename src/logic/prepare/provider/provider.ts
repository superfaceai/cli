import type {
  ProviderEntry,
  SecurityValues,
  SuperJsonDocument,
} from '@superfaceai/ast';
import { mergeProvider, NodeFileSystem } from '@superfaceai/one-sdk';
import { ServiceApiError } from '@superfaceai/service-client';
import inquirer from 'inquirer';

import type { ILogger } from '../../../common';
import { UNVERIFIED_PROVIDER_PREFIX } from '../../../common';
import type { UserError } from '../../../common/error';
import { fetchProviderInfo } from '../../../common/http';
import { OutputStream } from '../../../common/output-stream';
import { resolveSuperfaceRelativePath } from '../../../common/path';
import * as providerTemplate from '../../../templates/provider';
import { selecetBaseUrl } from './base-url';
import { selectIntegrationParameters } from './parameters';
import { selectSecurity } from './security';

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
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<void> {
  if (
    superJson.providers?.[provider] !== undefined &&
    options?.force !== true
  ) {
    logger.warn('providerAlreadyExists', provider);

    return;
  }
  // TODO: if provider is local and without unverified prefix - rename?

  // check remote
  let name: string = provider;
  if (!provider.startsWith(UNVERIFIED_PROVIDER_PREFIX)) {
    try {
      await fetchProviderInfo(name);
      // const remote =  await fetchProviderInfo(provider);

      // const useRemote = (
      //   await inquirer.prompt({
      //     name: 'continue',
      //     message: `Provider "${provider}" found in Superface registry:\n${JSON.stringify(remote, undefined, 2)}\nDo you want to use it?`,
      //     type: 'confirm',
      //     default: true,
      //   })
      // ).continue;

      // if(useRemote) {
      //   // TODO: set up values and add provider to super json
      // }
    } catch (error) {
      // If provider does not exists in SF register (is not verified) it should start with unverified
      if (error instanceof ServiceApiError && error.status === 404) {
        const rename = (
          await inquirer.prompt<{ continue: boolean }>({
            name: 'continue',
            message: `Provider: ${name} does not exist in Superface store and it does not start with: ${UNVERIFIED_PROVIDER_PREFIX} prefix.\nDo you want to rename it to "${UNVERIFIED_PROVIDER_PREFIX}${name}"?`,
            type: 'confirm',
            default: true,
          })
        ).continue;

        if (rename) {
          name = `${UNVERIFIED_PROVIDER_PREFIX}${name}`;
        }
      } else {
        throw userError(
          `Error when fetching provider info: ${String(error)}`,
          1
        );
      }
    }
  }

  // prepare base url
  const baseUrl = await selecetBaseUrl(name, { userError });

  // prepare security
  const security = await selectSecurity(name);

  // prepare integration parameters
  const parameters = await selectIntegrationParameters(name);

  let filePath: string;
  if (options?.station === true) {
    filePath = `providers/${name}.json`;
  } else {
    filePath = `${name}.json`;
  }

  const created = await OutputStream.writeIfAbsent(
    filePath,
    providerTemplate.full(
      name,
      baseUrl,
      security.scheme ? [security.scheme] : [],
      parameters.parameters
    ),
    { force: options?.force, dirs: true }
  );

  if (created) {
    logger.success('createProvider', name, filePath);
    await updateSuperJson(
      {
        name,
        superJson,
        superJsonPath,
        security: security.value ? [security.value] : [],
        parameters: parameters.values,
        path: filePath,
      },
      { logger }
    );
  }
}

async function updateSuperJson(
  {
    name,
    superJson,
    superJsonPath,
    path,
    security,
    parameters,
  }: {
    name: string;
    superJson: SuperJsonDocument;
    superJsonPath: string;
    path?: string;
    security: SecurityValues[];
    parameters: Record<string, string>;
  },
  { logger }: { logger: ILogger }
) {
  const payload: ProviderEntry = {};

  if (security.length > 0) {
    payload.security = security;
  }

  if (Object.keys(parameters).length > 0) {
    payload.parameters = parameters;
  }

  if (path !== undefined) {
    payload.file = resolveSuperfaceRelativePath(superJsonPath, path);
  }
  mergeProvider(superJson, name, payload, NodeFileSystem);

  await OutputStream.writeOnce(
    superJsonPath,
    JSON.stringify(superJson, undefined, 2)
  );
  logger.info('updateSuperJson', superJsonPath);
}