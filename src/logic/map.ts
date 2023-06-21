import type { ProviderJson } from '@superfaceai/ast';
import type { ServiceClient } from '@superfaceai/service-client';

import type { ILogger } from '../common';
import { SuperfaceClient } from '../common/http';
import { pollUrl } from '../common/polling';

export type MapPreparationResponse = {
  source: string;
};

function assertMapResponse(
  input: unknown
): asserts input is MapPreparationResponse {
  if (typeof input === 'object' && input !== null && 'source' in input) {
    const tmp = input as { source: string };

    if (typeof tmp.source === 'string') {
      return;
    }
  }

  throw Error(`Unexpected response received`);
}

export async function mapProviderToProfile(
  {
    providerJson,
    profile,
    options,
  }: {
    providerJson: ProviderJson;
    profile: {
      scope?: string;
      source: string;
      name: string;
    };
    options?: {
      quiet?: boolean;
    };
  },
  { logger }: { logger: ILogger }
): Promise<string> {
  const client = SuperfaceClient.getClient();

  const jobUrl = await startMapPreparation(
    // TODO: add old map if exists
    { providerJson, profile, map: undefined },
    { client }
  );

  const resultUrl = await pollUrl(
    { url: jobUrl, options: { quiet: options?.quiet } },
    { logger, client }
  );

  return (
    await finishMapPreparation(resultUrl, {
      client,
    })
  ).source;
}

async function startMapPreparation(
  {
    profile,
    providerJson,
    map,
  }: {
    profile: {
      scope?: string;
      source: string;
      name: string;
    };
    providerJson: ProviderJson;
    map?: string;
  },
  { client }: { client: ServiceClient }
): Promise<string> {
  const profileId = `${profile.scope !== undefined ? profile.scope + '.' : ''}${
    profile.name
  }`;
  const jobUrlResponse = await client.fetch(
    `/authoring/profiles/${profileId}/maps`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        map,
        provider: providerJson,
        profile: profile.source,
      }),
    }
  );

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

async function finishMapPreparation(
  resultUrl: string,
  { client }: { client: ServiceClient }
): Promise<MapPreparationResponse> {
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

  assertMapResponse(body);

  return body;
}
