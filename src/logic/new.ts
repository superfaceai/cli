import type { ProviderJson } from '@superfaceai/ast';
import { parseProfile, Source } from '@superfaceai/parser';
import type { ServiceClient } from '@superfaceai/service-client';

import type { ILogger } from '../common';
import { SuperfaceClient } from '../common/http';
import { pollUrl } from '../common/polling';

export type ProfilePreparationResponse = {
  // Id of the profile with . separated scope and name
  id: string;
  // TODO: get AST from server to avoid parsing (possible problems with AST/Parser versioning)?
  profile: {
    source: string;
  };
};

function assertProfileResponse(
  input: unknown
): asserts input is ProfilePreparationResponse {
  if (
    typeof input === 'object' &&
    input !== null &&
    'id' in input &&
    'profile' in input
  ) {
    const tmp = input as { id: string; profile: { source?: string } };

    if (typeof tmp.profile.source !== 'string') {
      throw Error(
        `Unexpected response received - missing profile source: ${JSON.stringify(
          tmp,
          null,
          2
        )}`
      );
    }

    try {
      parseProfile(new Source(tmp.profile.source));
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
    source: profileResponse.profile.source,
    scope,
    name,
  };
}

async function startProfilePreparation(
  { providerJson, prompt }: { providerJson: ProviderJson; prompt: string },
  { client }: { client: ServiceClient }
): Promise<string> {
  // TODO: check real url
  const jobUrlResponse = await client.fetch(`/authoring/profiles`, {
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
