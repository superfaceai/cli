import type { SuperJsonDocument } from '@superfaceai/ast';
import { assertProviderJson } from '@superfaceai/ast';

import type { ILogger } from '../../common';
import { getProviderFile } from '../../common';
import type { UserError } from '../../common/error';
import { readFile } from '../../common/io';
import type { ProfileId } from '../../common/profile';
import { CURLParser } from 'parse-curl-js';
import console from 'console';
// import { loadProfileAst } from '../prepare/utils';

export async function prepareMapFromCurl(
  {
    curl,
    id,
    superJson,
    superJsonPath,
  }: // options,
  {
    curl: string;
    id: {
      profile: ProfileId;
      provider: string;
      variant?: string;
    };
    superJson: SuperJsonDocument;
    superJsonPath: string;
    // options?: {
    //   force?: boolean;
    //   station?: boolean;
    // };
  },
  // TODO: add deps for FileSystem
  { userError }: { logger: ILogger; userError: UserError }
): Promise<void> {
  const parsed = new CURLParser(curl).parse();

  console.log('parsed', parsed)

  // Load profile
  //  const profileFile = await getProfileFile(
  //   id.profile,
  //   { superJson, superJsonPath },
  //   { userError }
  // );
  // const profileAst = await loadProfileAst(profileFile, { userError });

  // Load provider
  const providerFile = await getProviderFile(
    id.provider,
    { superJson, superJsonPath },
    { userError }
  );
  const provider = assertProviderJson(
    JSON.parse(await readFile(providerFile, { encoding: 'utf-8' }))
  );

  // resolve url

  const url = new URL(parsed.url);

  console.log('urlized', url);

  console.log('serv', provider.services)
  const usedService = provider.services.find(s =>
    parsed.url.startsWith(s.baseUrl)
  );
  if (usedService === undefined) {
    throw new Error('Service not found');
  }

  let endpointUrl = parsed.url.substring(usedService.baseUrl.length)

  if(url.search !== '') {
    endpointUrl = endpointUrl.split(url.search)[0]
  }
  if(!endpointUrl.endsWith('/')) {
    endpointUrl += '/'
  }

  console.log('end url', endpointUrl);

  // resolve body

  // resolve headers

  // resolve query

  let query: undefined | string = undefined
  if(Object.keys(parsed.query).length !== 0) {
    query = Object.entries(parsed.query).map(e => `${e[0]} = ${e[1]}`).join('\n')
  }

  // resolve params

  // resolve security

  const call = `http ${parsed.method} ${endpointUrl} {
    security none

    request {
      query {
        ${query !== undefined ? query : ''}
      }
    }
  }`

  console.log(call)
}
