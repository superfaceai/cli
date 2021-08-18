import { Netrc } from 'netrc-parser';

//TODO: different key name?
export const SUPERFACE_NETRC_HOST = 'api.superface.ai';

export function loadNetrc(): {
  baseUrl?: string;
  refreshToken?: string;
} {
  const netrc = new Netrc();
  netrc.loadSync();
  const superfaceEntry = netrc.machines[SUPERFACE_NETRC_HOST] ?? {};

  let baseUrl: string | undefined = undefined;
  if ('baseUrl' in superfaceEntry) {
    baseUrl = (superfaceEntry as { baseUrl: string }).baseUrl;
  }

  return {
    baseUrl,
    refreshToken: superfaceEntry.password,
  };
}

export async function saveNetrc(
  baseUrl: string,
  refreshToken: string
): Promise<void> {
  const netrc = new Netrc();
  await netrc.load();

  //Remove old record
  netrc.machines[SUPERFACE_NETRC_HOST] = {};

  netrc.machines[SUPERFACE_NETRC_HOST].password = refreshToken;
  netrc.machines[SUPERFACE_NETRC_HOST].baseUrl = baseUrl;
  await netrc.save();
}
