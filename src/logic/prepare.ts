import type { ProviderJson } from '@superfaceai/ast';
import { assertProviderJson } from '@superfaceai/ast';
import type { ServiceClient } from '@superfaceai/service-client';

import type { ILogger } from '../common';
import { SuperfaceClient } from '../common/http';
import { pollUrl } from '../common/polling';

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
  { logger }: { logger: ILogger }
): Promise<ProviderJson> {
  logger.info('preparationStarted');

  const client = SuperfaceClient.getClient();

  const jobUrl = await startProviderPreparation(
    { source: urlOrSource, name },
    { client }
  );

  const resultUrl = await pollUrl(
    { url: jobUrl, options: { quiet: options?.quiet } },
    { logger, client }
  );

  return finishProviderPreparation(resultUrl, {
    client,
  });
}

async function startProviderPreparation(
  { source, name }: { source: string; name?: string },
  { client }: { client: ServiceClient }
): Promise<string> {
  const jobUrlResponse = await client.fetch(`/authoring/providers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source, name }),
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

async function finishProviderPreparation(
  resultUrl: string,
  { client }: { client: ServiceClient }
): Promise<ProviderJson> {
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

  return assertProviderJson(body);
}
