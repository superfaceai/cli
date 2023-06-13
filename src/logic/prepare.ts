import type { ProviderJson } from '@superfaceai/ast';

import type { ILogger } from '../common';
// import { SuperfaceClient } from '../common/http';
// import { poll } from '../common/polling';
import { mockProviderJson } from '../test/provider-json';

export async function prepareProviderJson(
  _urlOrSource: string,
  _name: string | undefined,
  _options: {
    quiet?: boolean;
  },
  { logger }: { logger: ILogger }
): Promise<ProviderJson> {
  logger.info('preparationStarted');
  // TODO: error handling, validation, move to common/http.ts?
  // const client = SuperfaceClient.getClient();
  // const jobUrlResponse = await client.fetch(`/providers`, {
  //   method: 'POST',
  //   body: JSON.stringify({ source: urlOrSource, name }),
  // });

  // if (jobUrlResponse.status !== 202) {
  //   throw Error(`Unexpected status code ${jobUrlResponse.status} received`);
  // }

  // const jobUrl = (
  //   (await jobUrlResponse.json()) as {
  //     href: string;
  //   }
  // ).href;

  // // TODO: poll return value of POST /providers until it is ready
  // const resultUrl = await poll(jobUrl);

  // const resultResponse = await client.fetch(resultUrl);

  // if (resultResponse.status !== 200) {
  //   throw Error(`Unexpected status code ${resultResponse.status} received`);
  // }

  // //TODO: validate result json, separate function, is it ProviderJson or Provider definition?
  // const result = (await resultResponse.json()) as ProviderJson;

  // return result;

  return mockProviderJson({ name: _name });
}
