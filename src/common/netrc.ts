import { Netrc } from 'netrc-parser';

import { getServicesUrl } from './http';

export function loadNetrc(): {
  baseUrl: string;
  refreshToken?: string;
} {
  const netrc = new Netrc();
  const baseUrl = getServicesUrl();
  netrc.loadSync();
  const superfaceEntry = netrc.machines[baseUrl] ?? {};

  return {
    baseUrl,
    refreshToken: superfaceEntry.password,
  };
}

export async function saveNetrc(
  baseUrl: string,
  refreshToken: string | null
): Promise<void> {
  const netrc = new Netrc();
  await netrc.load();

  //Remove old record
  netrc.machines[baseUrl] = {};

  netrc.machines[baseUrl].password = refreshToken || undefined;
  netrc.machines[baseUrl].baseUrl = baseUrl;
  await netrc.save();
}
