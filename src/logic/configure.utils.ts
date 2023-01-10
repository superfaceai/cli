import { fetchProviders } from '../common/http';
import type { ILogger } from '../common/log';

export async function isCompatible(
  profile: string,
  providers: string[],
  { logger }: { logger: ILogger }
): Promise<boolean> {
  const compatibleProviders = (await fetchProviders(profile)).map(
    providerJson => providerJson.name
  );
  for (const provider of providers) {
    if (!compatibleProviders.includes(provider)) {
      logger.error(
        'compatibleProviderNotFound',
        provider,
        profile,
        compatibleProviders
      );

      return false;
    }
  }

  return true;
}
