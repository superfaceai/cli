import { curlToObject } from '@mdwitr0/curl-parser';
import type { ProviderJson } from '@superfaceai/ast';
import { inspect } from 'util';

import type { Model } from '../../templates/prepared-map/usecase/models';
import { resolveBody } from './resolve-body';
import { resolveQuery } from './resolve-query';
import { resilveUrl } from './resolve-url';

export function parseCurl({
  curl,
  provider,
}: {
  curl: string;
  provider: ProviderJson;
}): {
  url?: string;
  method?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: Model;
} {
  console.log('curl', curl);
  const parsed = curlToObject(curl.trim());

  console.log('parsed', inspect(parsed, true, 20));

  // resolve body

  // resolve params

  // resolve security

  return {
    method: parsed.method,
    // resolve url
    url: resilveUrl(parsed.href, provider),
    // resolve query
    query: resolveQuery(parsed.params),
    // resolve headers
    headers: parsed.headers,
    body: resolveBody(parsed.data),
  };
}
