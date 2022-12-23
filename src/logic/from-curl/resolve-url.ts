import type { ProviderJson } from '@superfaceai/ast';

export function resilveUrl(
  url: string | undefined,
  provider: ProviderJson
): string | undefined {
  if (url === undefined) {
    return undefined;
  }
  const urlInstance = new URL(url.trim());

  const usedService = provider.services.find(s => url.startsWith(s.baseUrl));
  if (usedService === undefined) {
    throw new Error('Service not found');
  }

  let endpointUrl = url.substring(usedService.baseUrl.length);

  if (urlInstance.search !== '') {
    endpointUrl = endpointUrl.split(urlInstance.search)[0];
  }
  if (!endpointUrl.endsWith('/')) {
    endpointUrl += '/';
  }

  return endpointUrl;
}
