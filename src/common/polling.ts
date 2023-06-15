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
      throw Error(`Polling failed with reason: ${result.failure_reason}`);
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

  throw Error(`Polling timed out after ${timeoutMilliseconds} milliseconds`);
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
    // TODO: validate result json
    const data = (await result.json()) as PollResponse;

    return data;
  } else {
    throw Error(`Unexpected status code ${result.status} received`);
  }
}
