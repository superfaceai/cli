import type { ServiceClient } from '@superfaceai/service-client';

import type { ILogger } from './log';

// TODO: timeout must be way longer than 60 seconds, because of the time it takes to build the provider
export const DEFAULT_POLLING_TIMEOUT_SECONDS = 60;
export const DEFAULT_POLLING_INTERVAL_SECONDS = 1;

enum PollStatus {
  Successful = 'Successful',
  Pending = 'Pending',
  Failed = 'Failed',
}
type PollResponse =
  | { result_url: string; status: PollStatus.Successful }
  | {
      status: PollStatus.Pending;
      events: {
        occuredAt: Date;
        type: string;
        description: string;
      }[];
    }
  | { status: PollStatus.Failed; failure_reason: string };

function isPollResponse(input: unknown): input is PollResponse {
  if (typeof input === 'object' && input !== null && 'status' in input) {
    const tmp = input as {
      status: string;
      result_url?: string;
      failure_reason?: string;
      events?: { occuredAt: Date; type: string; description: string }[];
    };

    if (
      tmp.status === PollStatus.Successful &&
      typeof tmp.result_url === 'string'
    ) {
      return true;
    } else if (
      tmp.status === PollStatus.Pending &&
      Array.isArray(tmp.events) &&
      tmp.events.every(
        event =>
          typeof event.type === 'string' &&
          typeof event.description === 'string'
      )
    ) {
      return true;
    } else if (
      tmp.status === PollStatus.Failed &&
      typeof tmp.failure_reason === 'string'
    ) {
      return true;
    }
  }

  return false;
}

export async function pollUrl(
  {
    url,
    options,
  }: {
    url: string;
    options?: {
      pollingTimeoutSeconds?: number;
      pollingIntervalSeconds?: number;
      quiet?: boolean;
    };
  },
  {
    logger,
    client,
  }: {
    logger: ILogger;
    client: ServiceClient;
  }
): Promise<string> {
  const startPollingTimeStamp = new Date();
  const timeoutMilliseconds =
    (options?.pollingTimeoutSeconds ?? DEFAULT_POLLING_TIMEOUT_SECONDS) * 1000;
  const pollingIntervalMilliseconds =
    (options?.pollingIntervalSeconds ?? DEFAULT_POLLING_INTERVAL_SECONDS) *
    1000;
  while (
    new Date().getTime() - startPollingTimeStamp.getTime() <
    timeoutMilliseconds
  ) {
    const result = await pollFetch(url, { client });

    if (result.status === PollStatus.Successful) {
      return result.result_url;
    } else if (result.status === PollStatus.Failed) {
      throw Error(`Failed to prepare provider: ${result.failure_reason}`);
    }

    // get events from response and present them to user
    if (result.events.length > 0 && options?.quiet !== true) {
      const lastEvent = result.events[result.events.length - 1];

      logger.info('pollingEvent', lastEvent.type, lastEvent.description);
    }

    await new Promise(resolve =>
      setTimeout(resolve, pollingIntervalMilliseconds)
    );
  }

  throw Error(`Prepare provider timed out after ${timeoutMilliseconds} milliseconds`);
}

async function pollFetch(
  url: string,
  { client }: { client: ServiceClient }
): Promise<PollResponse> {
  const result = await client.fetch(url, {
    method: 'GET',
    // Url from server is complete, so we don't need to add baseUrl
    baseUrl: '',
    headers: {
      accept: 'application/json',
    },
  });
  if (result.status === 200) {
    const data = (await result.json()) as unknown;

    if (isPollResponse(data)) {
      return data;
    }

    throw Error(
      `Unexpected response from server: ${JSON.stringify(data, null, 2)}`
    );
  }
  throw Error(`Unexpected status code ${result.status} received`);
}
