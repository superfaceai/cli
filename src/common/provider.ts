import type { ProviderJson } from '@superfaceai/ast';
import {
  AssertionError,
  assertProviderJson,
  isValidProviderName,
} from '@superfaceai/ast';
import type { ServiceClient } from '@superfaceai/service-client';

import type { UserError } from './error';
import { stringifyError } from './error';
import { buildProviderPath } from './file-structure';
import { exists, readFile } from './io';
import { OutputStream } from './output-stream';

// TODO: move to common
export async function resolveProviderJson(
  providerName: string | undefined,
  { userError, client }: { userError: UserError; client: ServiceClient }
): Promise<
  {
    providerJson: ProviderJson;
  } & ({ source: 'local'; path: string } | { source: 'remote' })
> {
  if (providerName === undefined) {
    throw userError(
      'Missing provider name. Please provide it as first argument.',
      1
    );
  }

  if (!isValidProviderName(providerName)) {
    throw userError('Invalid provider name', 1);
  }

  let resolvedProviderJson: {
    providerJson: ProviderJson;
  } & ({ source: 'local'; path: string } | { source: 'remote' });

  if (!(await exists(buildProviderPath(providerName)))) {
    resolvedProviderJson = {
      providerJson: await resolveRemote(providerName, { userError, client }),
      source: 'remote',
    };
  } else {
    const localProviderJson = await resolveLocal(providerName, { userError });
    resolvedProviderJson = {
      providerJson: localProviderJson.providerJson,
      path: localProviderJson.path,
      source: 'local',
    };
  }

  if (providerName !== resolvedProviderJson.providerJson.name) {
    throw userError(
      `Provider name in provider.json file does not match provider name in command.`,
      1
    );
  }

  if (
    resolvedProviderJson.providerJson.services.length === 1 &&
    resolvedProviderJson.providerJson.services[0].baseUrl.includes('TODO')
  ) {
    if (resolvedProviderJson.source === 'local') {
      throw userError(
        `Provider.json file is not properly configured. Please make sure to replace 'TODO' in baseUrl with the actual base url of the API.`,
        1
      );
    }

    throw userError(
      `Provider.json file saved to: ${buildProviderPath(
        providerName
      )} but it is not properly configured. Please make sure to replace 'TODO' in baseUrl with the actual base url of the API.`,
      1
    );
  }

  return resolvedProviderJson;
}

async function resolveRemote(
  providerName: string,
  { userError, client }: { userError: UserError; client: ServiceClient }
): Promise<ProviderJson> {
  let resolvedProviderJson: ProviderJson | undefined;

  let providerResponse: Response;
  try {
    providerResponse = await client.fetch(
      `/authoring/providers/${providerName}`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      }
    );
  } catch (e) {
    throw userError(
      `Failed to fetch provider.json file from Superface API. ${stringifyError(
        e
      )}`,
      1
    );
  }

  if (providerResponse.status === 200) {
    try {
      const response: unknown = await providerResponse.json();

      assertProviderResponse(response);

      resolvedProviderJson = assertProviderJson(response.definition);
    } catch (e) {
      if (e instanceof AssertionError) {
        throw userError(`Invalid provider.json. ${e.message}`, 1);
      }
      throw userError(`Invalid provider.json - invalid JSON`, 1);
    }
  } else if (providerResponse.status === 404) {
    throw userError(
      `Provider ${providerName} does not exist. Make sure to run "superface prepare" before running this command.`,
      1
    );
  } else {
    throw userError(
      `Failed to fetch provider.json file from Superface API. ${stringifyError(
        providerResponse
      )}`,
      1
    );
  }

  await OutputStream.writeOnce(
    buildProviderPath(resolvedProviderJson.name),
    JSON.stringify(resolvedProviderJson, null, 2)
  );

  return resolvedProviderJson;
}

async function resolveLocal(
  providerName: string,
  { userError }: { userError: UserError }
): Promise<{
  providerJson: ProviderJson;
  path: string;
}> {
  let resolvedProviderJson: ProviderJson | undefined;
  const path = buildProviderPath(providerName);
  const providerJsonFile = await readFile(path, 'utf-8');
  let providerJson: ProviderJson;
  try {
    providerJson = JSON.parse(providerJsonFile) as ProviderJson;
  } catch (e) {
    throw userError(`Invalid provider.json file - invalid JSON`, 1);
  }

  try {
    resolvedProviderJson = assertProviderJson(providerJson);
  } catch (e) {
    if (e instanceof AssertionError) {
      throw userError(`Invalid provider.json file. ${e.message}`, 1);
    }
    throw userError(`Invalid provider.json file.`, 1);
  }

  return {
    providerJson: resolvedProviderJson,
    path,
  };
}

function assertProviderResponse(response: unknown): asserts response is {
  definition: unknown;
} {
  if (
    typeof response !== 'object' ||
    response === null ||
    !('definition' in response)
  ) {
    throw new Error('Invalid provider.json response');
  }
}
