import { Netrc } from 'netrc-parser';

import { getServicesUrl } from './http';

export function loadNetrc(): string | undefined {
  //environment variable for specific netrc file
  const netrc = new Netrc(process.env.NETRC_FILEPATH);
  console.log('net rc url', getServicesUrl())
  const machine = new URL(getServicesUrl()).host
  netrc.loadSync();
  const superfaceEntry = netrc.machines[machine] ?? {};

  return superfaceEntry.password
}

export async function saveNetrc(
  _baseUrl: string,
  refreshToken: string | null
): Promise<void> {
  //environment variable for specific netrc file
  const netrc = new Netrc(process.env.NETRC_FILEPATH);
  const machine = new URL(getServicesUrl()).host

  await netrc.load();

  //Remove old record
  netrc.machines[machine] = {};
  netrc.machines[machine].password = refreshToken || undefined;
  await netrc.save();
}
