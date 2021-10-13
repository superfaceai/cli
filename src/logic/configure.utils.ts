import { SecurityValues } from '@superfaceai/ast';
import {
  isApiKeySecurityScheme,
  isBasicAuthSecurityScheme,
  isBearerTokenSecurityScheme,
  isDigestSecurityScheme,
  SecurityScheme,
  // Please use the exact path when importing the module from `@superfaceai/one-sdk`.
  // This prevents from resolving top-level imports of other modules from SDK;
  // and allows for easier bundling when using this module in other
  // projects, e.g. frontend.
} from '@superfaceai/one-sdk/dist/internal/providerjson';

import { LogCallback } from '../common/log';

export function prepareSecurityValues(
  providerName: string,
  schemes: SecurityScheme[],
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
  }
): SecurityValues[] {
  const security: SecurityValues[] = [];

  for (const scheme of schemes) {
    options?.logCb?.(
      `Configuring ${security.length + 1}/${schemes.length} security schemes`
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
      options?.warnCb?.(
        `⚠️  Provider: "${providerName}" contains unknown security scheme`
      );
    }
  }

  return security;
}
