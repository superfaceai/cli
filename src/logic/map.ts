import type { ProviderJson } from '@superfaceai/ast';
import type { ServiceClient } from '@superfaceai/service-client';

import type { UserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { pollUrl } from '../common/polling';
import type { UX } from '../common/ux';

export type MapPreparationResponse = {
  source: string;
};

function assertMapResponse(
  input: unknown,
  { userError }: { userError: UserError }
): asserts input is MapPreparationResponse {
  if (typeof input === 'object' && input !== null && 'source' in input) {
    const tmp = input as { source: string };

    if (typeof tmp.source === 'string') {
      return;
    }
  }

  throw userError(`Unexpected response received`, 1);
}

export async function mapProviderToProfile(
  {
    providerJson,
    profile,
    options,
  }: {
    providerJson: ProviderJson;
    profile: string;
    options?: {
      quiet?: boolean;
    };
  },
  { ux, userError }: { ux: UX; userError: UserError }
): Promise<string> {
  const client = SuperfaceClient.getClient();

  const jobUrl = await startMapPreparation(
    // TODO: add old map if exists
    { providerJson, profile, map: undefined },
    { client, userError }
  );

  const resultUrl = await pollUrl(
    { url: jobUrl, options: { quiet: options?.quiet } },
    { client, ux, userError }
  );

  return (
    await finishMapPreparation(resultUrl, {
      client,
      userError,
    })
  ).source;
}

async function startMapPreparation(
  {
    profile,
    providerJson,
    map,
  }: {
    profile: string;
    providerJson: ProviderJson;
    map?: string;
  },
  { client, userError }: { client: ServiceClient; userError: UserError }
): Promise<string> {
  const jobUrlResponse = await client.fetch(`/authoring/maps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      map,
      provider: providerJson,
      profile,
    }),
  });

  if (jobUrlResponse.status !== 202) {
    if (jobUrlResponse.status === 401) {
      throw userError(
        `This command is available to authenticated users only. Please log in using \`superface login\``,
        1
      );
    }
    throw userError(
      `Unexpected status code ${jobUrlResponse.status} received`,
      1
    );
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
  { client, userError }: { client: ServiceClient; userError: UserError }
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
    throw userError(
      `Unexpected status code ${resultResponse.status} received`,
      1
    );
  }

  const body = (await resultResponse.json()) as unknown;

  assertMapResponse(body, { userError });

  return body;
}
