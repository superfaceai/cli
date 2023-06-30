import type { ServiceClient } from '@superfaceai/service-client';

import type { ILogger } from './log';

// TODO: timeout must be way longer than 60 seconds, because of the time it takes to build the provider
export const DEFAULT_POLLING_TIMEOUT_SECONDS = 60;
export const DEFAULT_POLLING_INTERVAL_SECONDS = 1;

enum PollStatus {
  Success = 'Success',
  Pending = 'Pending',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
}
enum PollResultType {
  Provider = 'Provider',
  Profile = 'Profile',
  Map = 'Map',
}
type PollResponse =
  | { result_url: string; status: PollStatus.Success, result_type: PollResultType }
  | {
      status: PollStatus.Pending;
      events: {
        occuredAt: Date;
        type: string;
        description: string;
      }[];
      result_type: PollResultType
    }
  | { status: PollStatus.Failed; failure_reason: string; result_type: PollResultType }
  | { status: PollStatus.Cancelled; result_type: PollResultType }

function isPollResponse(input: unknown): input is PollResponse {
  if (typeof input === 'object' && input !== null && 'status' in input) {
    const tmp = input as {
      status: string;
      result_url?: string;
      result_type: string;
      failure_reason?: string;
      events?: { occuredAt: Date; type: string; description: string }[];
    };

    if( !Object.values<string>(PollResultType).includes(tmp.result_type)) {
      return false;
    }

    if (
      tmp.status === PollStatus.Success &&
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
    } else if (
      tmp.status === PollStatus.Cancelled
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

    if (result.status === PollStatus.Success) {
      return result.result_url;
    } else if (result.status === PollStatus.Failed) {
      throw Error(`Failed to ${getJobDescription(result.result_type)}: ${result.failure_reason}`);
    } else if (result.status === PollStatus.Cancelled) {
      throw Error(`Failed to ${getJobDescription(result.result_type)}: Operation has been cancelled.`);
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

  throw Error(
    `Operation timed out after ${timeoutMilliseconds} milliseconds`
  );
}

function getJobDescription(resultType: string) {
  if(resultType === PollResultType.Provider) {
    return 'prepare provider'
  } else if(resultType === PollResultType.Profile) {
    return 'create profile';
  } else if(resultType === PollResultType.Map) {
    return 'create map'
  }

  return `create ${resultType.toLowerCase()}`
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
