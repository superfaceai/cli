import type { ProviderJson } from '@superfaceai/ast';
import { assertProviderJson } from '@superfaceai/ast';
import type { ServiceClient } from '@superfaceai/service-client';

import type { UserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { pollUrl } from '../common/polling';
import type { UX } from '../common/ux';

type ProviderPreparationResponse = {
  provider_id: string;
  definition: ProviderJson;
  docs_url: string;
};

type ProviderDocsResponse = {
  data: {
    source: string;
    created_at: string;
  }[];
  url: string;
};

function assertProviderDocsResponse(
  input: unknown,
  { userError }: { userError: UserError }
): asserts input is ProviderDocsResponse {
  if (
    typeof input === 'object' &&
    input !== null &&
    'data' in input &&
    'url' in input
  ) {
    const tmp = input as {
      data: {
        source: string;
        created_at: string;
      }[];
      url: string;
    };

    if (
      typeof tmp.url === 'string' &&
      Array.isArray(tmp.data) &&
      tmp.data.every(item => typeof item.source === 'string') &&
      tmp.data.every(item => typeof item.created_at === 'string')
    ) {
      return;
    }
  }

  throw userError(`Unexpected response received`, 1);
}

function assertProviderResponse(
  input: unknown,
  { userError }: { userError: UserError }
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

  throw userError(`Unexpected response received`, 1);
}

export async function prepareProviderJson(
  {
    urlOrSource,
    name,
    options,
  }: {
    urlOrSource: string;
    name: string | undefined;
    options: {
      quiet?: boolean;
      getDocs?: boolean;
      timeout: number;
    };
  },
  { userError, ux }: { userError: UserError; ux: UX }
): Promise<{ definition: ProviderJson; docs?: string[] }> {
  const client = SuperfaceClient.getClient();

  const jobUrl = await startProviderPreparation(
    { source: urlOrSource, name },
    { client, userError }
  );

  const resultUrl = await pollUrl(
    {
      url: jobUrl,
      options: {
        quiet: options.quiet,
        pollingTimeoutSeconds: options.timeout,
      },
    },
    { client, ux, userError }
  );

  const providerResponse = await finishProviderPreparation(resultUrl, {
    client,
    userError,
  });

  let docs: string[] | undefined;
  if (options?.getDocs === true) {
    docs = await getIndexedDocs(providerResponse.docs_url, {
      client,
      userError,
    });
  }

  return { definition: providerResponse.definition, docs };
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
        `You are not authorized. Please login using 'superface login'.`,
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

  assertProviderResponse(body, { userError });

  return body;
}

async function getIndexedDocs(
  docsUrl: string,
  { client, userError }: { client: ServiceClient; userError: UserError }
): Promise<string[]> {
  const resultResponse = await client.fetch(docsUrl, {
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

  assertProviderDocsResponse(body, { userError });

  return body.data.map(item =>
    item.source
      .split(/===+\n/)
      .filter(Boolean)
      .map(text => text.substring(0, 200).trim() + '...')
      .join('\n==========\n')
  );
}
