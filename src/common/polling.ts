import type { ServiceClient } from '@superfaceai/service-client';

import type { UserError } from './error';
import type { UX } from './ux';

export const DEFAULT_POLLING_TIMEOUT_SECONDS = 300;
export const DEFAULT_POLLING_INTERVAL_SECONDS = 2;

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
  | {
    result_url: string;
    status: PollStatus.Success;
    result_type: PollResultType;
  }
  | {
    status: PollStatus.Pending;
    events: {
      occuredAt: Date;
      type: string;
      description: string;
    }[];
    result_type: PollResultType;
  }
  | {
    status: PollStatus.Failed;
    failure_reason: string;
    result_type: PollResultType;
  }
  | { status: PollStatus.Cancelled; result_type: PollResultType };

function isPollResponse(input: unknown): input is PollResponse {
  if (typeof input === 'object' && input !== null && 'status' in input) {
    const tmp = input as {
      status: string;
      result_url?: string;
      result_type: string;
      failure_reason?: string;
      events?: { occuredAt: Date; type: string; description: string }[];
    };

    if (!Object.values<string>(PollResultType).includes(tmp.result_type)) {
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
    } else if (tmp.status === PollStatus.Cancelled) {
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
    client,
    userError,
    ux,
  }: {
    client: ServiceClient;
    userError: UserError;
    ux: UX;
  }
): Promise<string> {
  const startPollingTimeStamp = new Date();
  const timeoutMilliseconds =
    (options?.pollingTimeoutSeconds ?? DEFAULT_POLLING_TIMEOUT_SECONDS) * 1000;
  const pollingIntervalMilliseconds =
    (options?.pollingIntervalSeconds ?? DEFAULT_POLLING_INTERVAL_SECONDS) *
    1000;

  let lastEvenetDescription = '';
  while (
    new Date().getTime() - startPollingTimeStamp.getTime() <
    timeoutMilliseconds
  ) {
    const result = await pollFetch(url, { client, userError });

    if (result.status === PollStatus.Success) {
      ux.succeed(`Successfully finished operation`);
      return result.result_url;
    } else if (result.status === PollStatus.Failed) {
      throw userError(
        `Failed to ${getJobDescription(result.result_type)}: ${result.failure_reason
        }`,
        1
      );
    } else if (result.status === PollStatus.Cancelled) {
      throw userError(
        `Failed to ${getJobDescription(
          result.result_type
        )}: Operation has been cancelled.`,
        1
      );
    } else if (result.status === PollStatus.Pending) {
      // get events from response and present them to user
      if (result.events.length > 0 && options?.quiet !== true) {
        const currentEvent = result.events[result.events.length - 1];

        if (currentEvent.description !== lastEvenetDescription) {
          // console.log(`${currentEvent.type} - ${currentEvent.description}`);
          ux.info(`${currentEvent.type} - ${currentEvent.description}`);
        }

        lastEvenetDescription = currentEvent.description;

        await new Promise(resolve =>
          setTimeout(resolve, pollingIntervalMilliseconds)
        );
      }
    }
  }

  throw userError(
    `Operation timed out after ${timeoutMilliseconds} milliseconds`,
    1
  );
}

function getJobDescription(resultType: string) {
  if (resultType === PollResultType.Provider) {
    return 'prepare provider';
  } else if (resultType === PollResultType.Profile) {
    return 'create profile';
  } else if (resultType === PollResultType.Map) {
    return 'create map';
  }

  return `create ${resultType.toLowerCase()}`;
}

async function pollFetch(
  url: string,
  { client, userError }: { client: ServiceClient; userError: UserError }
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
    let data: unknown;
    try {
      data = (await result.json()) as unknown;
    } catch (error) {
      throw userError(
        `Unexpected response from server: ${JSON.stringify(
          await result.text(),
          null,
          2
        )}`,
        1
      );
    }

    if (isPollResponse(data)) {
      return data;
    }

    throw userError(
      `Unexpected response from server: ${JSON.stringify(data, null, 2)}`,
      1
    );
  }
  throw userError(`Unexpected status code ${result.status} received`, 1);
}
