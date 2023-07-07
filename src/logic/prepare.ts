import type { ProviderJson } from '@superfaceai/ast';
import { assertProviderJson } from '@superfaceai/ast';
import type { ServiceClient } from '@superfaceai/service-client';

import type { UserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { pollUrl } from '../common/polling';
import type { UX } from '../common/ux';

export type ProviderPreparationResponse = {
  provider_id: string;
  definition: ProviderJson;
  docs_url: string;
};

function assertProviderResponse(
  input: unknown
): asserts input is ProviderPreparationResponse {
  if (
    typeof input === 'object' &&
    input !== null &&
    'provider_id' in input &&
    'docs_url' in input &&
    'definition' in input
  ) {
    const tmp = input as {
      provider_id: string;
      definition: ProviderJson;
      docs_url: string;
    };

    if (
      typeof tmp.provider_id === 'string' &&
      typeof tmp.docs_url === 'string'
    ) {
      assertProviderJson(tmp.definition);

      return;
    }
  }

  throw Error(`Unexpected response received`);
}

export async function prepareProviderJson(
  {
    urlOrSource,
    name,
    options,
  }: {
    urlOrSource: string;
    name: string | undefined;
    options?: {
      quiet?: boolean;
    };
  },
  { userError, ux }: { userError: UserError; ux: UX }
): Promise<ProviderJson> {
  const client = SuperfaceClient.getClient();

  const jobUrl = await startProviderPreparation(
    { source: urlOrSource, name },
    { client, userError }
  );

  const resultUrl = await pollUrl(
    { url: jobUrl, options: { quiet: options?.quiet } },
    { client, ux, userError }
  );

  // TODO: use docs_url to keep track of docs
  return (
    await finishProviderPreparation(resultUrl, {
      client,
      userError,
    })
  ).definition;
}

async function startProviderPreparation(
  { source, name }: { source: string; name?: string },
  { client, userError }: { client: ServiceClient; userError: UserError }
): Promise<string> {
  const jobUrlResponse = await client.fetch(`/authoring/providers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source, name }),
  });

  if (jobUrlResponse.status !== 202) {
    if (jobUrlResponse.status === 401) {
      throw userError(
        `You are not authorized to access this resource. Make sure that you are logged in.`,
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
    throw userError(
      `Unexpected response body ${JSON.stringify(responseBody)} received`,
      1
    );
  }
}

async function finishProviderPreparation(
  resultUrl: string,
  { client, userError }: { client: ServiceClient; userError: UserError }
): Promise<ProviderPreparationResponse> {
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

  assertProviderResponse(body);

  return body;
}
