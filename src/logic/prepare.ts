import { ProviderJson } from '@superfaceai/ast';
import { SuperfaceClient } from '../common/http';
import { poll } from '../common/polling';

export async function prepareProviderJson(
  urlOrSource: string,
  name?: string
): Promise<ProviderJson> {
  // TODO: error handling, validation, move to common/http.ts?
  const client = SuperfaceClient.getClient();
  const jobUrlResponse = await client.fetch(`/providers`, {
    method: 'POST',
    body: JSON.stringify({ source: urlOrSource, name }),
  });

  if (jobUrlResponse.status !== 202) {
    throw Error(`Unexpected status code ${jobUrlResponse.status} received`);
  }

  const jobUrl = (
    (await jobUrlResponse.json()) as {
      href: string;
    }
  ).href;

  // TODO: poll return value of POST /providers until it is ready
  const resultUrl = await poll(jobUrl);

  const resultResponse = await client.fetch(resultUrl);

  if (resultResponse.status !== 200) {
    throw Error(`Unexpected status code ${resultResponse.status} received`);
  }

  //TODO: validate result json, separate function, is it ProviderJson or Provider definition?
  const result = (await resultResponse.json()) as ProviderJson;

  return result;
}
