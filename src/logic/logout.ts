import { LogCallback } from '../common/log';

export async function logout(options?: {
  logCb?: LogCallback;
  warnCb?: LogCallback;
}): Promise<void> {
  //TODO: Check netRc before calling service-client?
  options?.logCb?.('Logging off from Superface');
  //TODO: use service client logout and signOff functions

  return Promise.resolve();
}
