import { SuperfaceClient } from './http';

export const DEFAULT_POLLING_TIMEOUT_SECONDS = 60;
export const DEFAULT_POLLING_INTERVAL_SECONDS = 1;

// TODO: finish types, add error handling, move to common/http.ts?
export async function poll(
  url: string,
  options?: {
    pollingTimeoutSeconds?: number;
    pollingIntervalSeconds?: number;
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
    const result = await pollFetch(url);

    if (result.status === 'successful') {
      return result.result_url;
    } else if (result.status === 'failed') {
      throw Error(`Polling failed with reason: ${result.failure_reason}`);
    }

    // TODO: get events from response and present them to user

    await new Promise(resolve =>
      setTimeout(resolve, pollingIntervalMilliseconds)
    );
  }

  throw Error(`Polling timed out after ${timeoutMilliseconds} milliseconds`);
}

// TODO: finish types, add error handling, check response statuses, add events from response
type PollResponse =
  | { result_url: string; status: 'successful' }
  | { status: 'pending' }
  | { status: 'failed'; failure_reason: string };
async function pollFetch(url: string): Promise<PollResponse> {
  const client = SuperfaceClient.getClient();

  const result = await client.fetch(url);
  if (result.status === 200) {
    const data = (await result.json()) as PollResponse;

    return data;
  } else {
    throw Error(`Unexpected status code ${result.status} received`);
  }
}
