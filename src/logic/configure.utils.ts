import {
  isApiKeySecurityScheme,
  isBasicAuthSecurityScheme,
  isBearerTokenSecurityScheme,
  isDigestSecurityScheme,
  SecurityScheme,
  SecurityValues,
} from '@superfaceai/ast';

import { fetchProviders } from '../common/http';
import { ILogger } from '../common/log';

export function prepareSecurityValues(
  providerName: string,
  schemes: SecurityScheme[],
  { logger }: { logger: ILogger }
): SecurityValues[] {
  const security: SecurityValues[] = [];

  for (const scheme of schemes) {
    logger.info(
      'configuringSecuritySchemes',
      security.length + 1,
      schemes.length
    );
    // Char "-" is not allowed in env variables so replace it with "_"
    const envProviderName = providerName.replace('-', '_').toUpperCase();
    if (isApiKeySecurityScheme(scheme)) {
      security.push({
        id: scheme.id,
        apikey: `$${envProviderName}_API_KEY`,
      });
    } else if (isBasicAuthSecurityScheme(scheme)) {
      security.push({
        id: scheme.id,
        username: `$${envProviderName}_USERNAME`,
        password: `$${envProviderName}_PASSWORD`,
      });
    } else if (isBearerTokenSecurityScheme(scheme)) {
      security.push({
        id: scheme.id,
        token: `$${envProviderName}_TOKEN`,
      });
    } else if (isDigestSecurityScheme(scheme)) {
      security.push({
        id: scheme.id,
        digest: `$${envProviderName}_DIGEST`,
      });
    } else {
      logger.warn('unknownSecurityScheme', providerName);
    }
  }

  return security;
}

export async function isCompatible(
  profile: string,
  providers: string[],
  { logger }: { logger: ILogger }
): Promise<boolean> {
  const compatibleProviders = await fetchProviders(profile);
  for (const provider of providers) {
    if (
      !compatibleProviders.find(providerJson => providerJson.name === provider)
    ) {
      logger.error(
        'compatibleProviderNotFound',
        provider,
        profile,
        compatibleProviders.map(providerJson => providerJson.name)
      );

      return false;
    }
  }

  return true;
}
