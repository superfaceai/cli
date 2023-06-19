import type { ProviderJson } from '@superfaceai/ast';
import { parseProfile, Source } from '@superfaceai/parser';
import type { ServiceClient } from '@superfaceai/service-client';

import type { ILogger } from '../common';
import { SuperfaceClient } from '../common/http';
import { pollUrl } from '../common/polling';

export type ProfilePreparationResponse = {
  // TODO: id format? . or /? or something else?
  id: string;
  // TODO: get AST from server to avoid parsing (possible problems with AST/Parser versioning)
  source: string;
};

function assertProfileResponse(
  input: unknown
): asserts input is ProfilePreparationResponse {
  if (
    typeof input === 'object' &&
    input !== null &&
    'id' in input &&
    'source' in input
  ) {
    const tmp = input as { id: string; source: string };

    try {
      parseProfile(new Source(tmp.source));
    } catch (e) {
      throw Error(
        `Unexpected response received - unable to parse profile source: ${JSON.stringify(
          e,
          null,
          2
        )}`
      );
    }

    // TODO: validate id format?
    if (typeof tmp.id === 'string') {
      return;
    }
  }

  throw Error(`Unexpected response received`);
}

export async function newProfile(
  {
    providerJson,
    prompt,
    options,
  }: {
    providerJson: ProviderJson;
    prompt: string;
    options?: { quiet?: boolean };
  },
  { logger }: { logger: ILogger }
): Promise<{ source: string; scope?: string; name: string }> {
  logger.info('startProfileGeneration', providerJson.name);

  console.log('newProfile', providerJson, prompt, options);

  const client = SuperfaceClient.getClient();

  const jobUrl = await startProfilePreparation(
    { providerJson, prompt },
    { client }
  );

  const resultUrl = await pollUrl(
    { url: jobUrl, options: { quiet: options?.quiet } },
    { logger, client }
  );

  const profileResponse = await finishProfilePreparation(resultUrl, {
    client,
  });

  const idParts = profileResponse.id.split('.');

  // Spliting id to scope and name
  // TODO: do not split id, but use it as is?
  let scope: string | undefined;
  let name: string;
  // TODO: validate id format (number of .)?
  if (idParts.length > 1) {
    scope = idParts[0];
    name = idParts[1];
  } else {
    name = idParts[0];
  }

  return {
    source: profileResponse.source,
    scope,
    name,
  };
}

async function startProfilePreparation(
  { providerJson, prompt }: { providerJson: ProviderJson; prompt: string },
  { client }: { client: ServiceClient }
): Promise<string> {
  // TODO: check real url
  const jobUrlResponse = await client.fetch(`/comlinks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, provider: providerJson }),
  });

  if (jobUrlResponse.status !== 202) {
    throw Error(`Unexpected status code ${jobUrlResponse.status} received`);
  }

  const responseBody = (await jobUrlResponse.json()) as Record<string, unknown>;

  if (
    typeof responseBody === 'object' &&
    responseBody !== null &&
    'href' in responseBody &&
    typeof responseBody.href === 'string'
  ) {
    return responseBody.href;
  } else {
    throw Error(
      `Unexpected response body ${JSON.stringify(responseBody)} received`
    );
  }
}

async function finishProfilePreparation(
  resultUrl: string,
  { client }: { client: ServiceClient }
): Promise<ProfilePreparationResponse> {
  const resultResponse = await client.fetch(resultUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
    // Url from server is complete, so we don't need to add baseUrl
    baseUrl: '',
  });

  if (resultResponse.status !== 200) {
    throw Error(`Unexpected status code ${resultResponse.status} received`);
  }

  const body = (await resultResponse.json()) as unknown;

  assertProfileResponse(body);

  return body;
}
