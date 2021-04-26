import {
  isApiKeySecurityScheme,
  isBasicAuthSecurityScheme,
  isBearerTokenSecurityScheme,
  isDigestSecurityScheme,
  parseProviderJson,
  ProviderJson,
  SecurityValues,
  SuperJson,
} from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import {
  constructProfileProviderSettings,
  META_FILE,
} from '../common/document';
import { userError } from '../common/error';
import { fetchProviderInfo } from '../common/http';
import { readFile } from '../common/io';
import { formatShellLog, LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';

/**
 * Handle responses from superface registry.
 * It saves new information about provider into super.json.
 * @returns number of configured security schemes
 */
export function handleProviderResponse(
  superJson: SuperJson,
  profileId: string,
  response: ProviderJson,
  options?: { logCb?: LogCallback; warnCb?: LogCallback }
): number {
  options?.logCb?.(`Installing provider: "${response.name}"`);

  const security: SecurityValues[] = [];

  if (response.securitySchemes) {
    for (const scheme of response.securitySchemes) {
      options?.logCb?.(
        `Configuring ${security.length + 1}/${
          response.securitySchemes.length
        } security schemes`
      );
      if (isApiKeySecurityScheme(scheme)) {
        security.push({
          id: scheme.id,
          apikey: `$${response.name.toUpperCase()}_API_KEY`,
        });
      } else if (isBasicAuthSecurityScheme(scheme)) {
        security.push({
          id: scheme.id,
          username: `$${response.name.toUpperCase()}_USERNAME`,
          password: `$${response.name.toUpperCase()}_PASSWORD`,
        });
      } else if (isBearerTokenSecurityScheme(scheme)) {
        security.push({
          id: scheme.id,
          token: `$${response.name.toUpperCase()}_TOKEN`,
        });
      } else if (isDigestSecurityScheme(scheme)) {
        security.push({
          id: scheme.id,
          digest: `$${response.name.toUpperCase()}_DIGEST`,
        });
      } else {
        options?.warnCb?.(
          `⚠️  Provider: "${response.name}" contains unknown security scheme`
        );
      }
    }
  }
  // update super.json
  superJson.addProvider(response.name, { security });

  //constructProfileProviderSettings returns Record<string, ProfileProviderEntry>
  superJson.addProfileProvider(
    profileId,
    response.name,
    constructProfileProviderSettings([response.name])[response.name]
  );

  return security.length;
}

/**
 * Mock the Superface registry API GET call with calls to Store API.
 * Query the provider info
 */
export async function getProviderFromStore(
  providerName: string,
  userAgent: string,
  options?: {
    logCb?: LogCallback;
  }
): Promise<ProviderJson> {
  options?.logCb?.(`Fetching provider ${providerName} from the Store`);

  try {
    const info = await fetchProviderInfo(providerName, userAgent);
    options?.logCb?.('GET Provider Info');

    return info;
  } catch (error) {
    throw userError(error, 1);
  }
}

/**
 *
 * @param superPath - path to directory where super.json located
 * @param provider - provider name or filepath specified as argument
 */
export async function installProvider(
  superPath: string,
  provider: string,
  profileId: string,
  userAgent: string,
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
    force?: boolean;
    local: boolean;
  }
): Promise<void> {
  const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
  const superJson = loadedResult.match(
    v => v,
    err => {
      options?.warnCb?.(err);

      return new SuperJson({});
    }
  );
  //Check if there is a version inside profile id
  profileId = profileId.split('@')[0];

  //Check profile existance
  if (!superJson.normalized.profiles[profileId]) {
    throw userError(
      `❌ profile ${profileId} not found in ${superPath}. Forgot to install?`,
      1
    );
  }

  //Load provider info
  let providerInfo: ProviderJson;
  //Load from file
  if (options?.local) {
    try {
      const file = await readFile(provider, { encoding: 'utf-8' });
      providerInfo = parseProviderJson(JSON.parse(file));
    } catch (error) {
      throw userError(error, 1);
    }
  } else {
    //Load from server
    providerInfo = await getProviderFromStore(provider, userAgent);
  }

  // Check existence and warn
  if (
    options?.force !== true &&
    superJson.normalized.providers[providerInfo.name]
  ) {
    options?.warnCb?.(
      `⚠️  Provider already exists: "${providerInfo.name}" (Use flag \`--force/-f\` for overwriting profiles)`
    );

    return;
  }

  //Write provider to super.json
  const numOfConfigured = handleProviderResponse(
    superJson,
    profileId,
    providerInfo,
    options
  );

  // write new information to super.json
  await OutputStream.writeOnce(superJson.path, superJson.stringified, options);
  options?.logCb?.(
    formatShellLog("echo '<updated super.json>' >", [superJson.path])
  );
  if (providerInfo.securitySchemes && providerInfo.securitySchemes.length > 0) {
    // inform user about instlaled security schemes
    if (numOfConfigured === 0) {
      options?.logCb?.(`❌ No security schemes have been configured.`);
    } else if (numOfConfigured < providerInfo.securitySchemes.length) {
      options?.logCb?.(
        `⚠️ Some security schemes have been configured. Configured ${numOfConfigured} out of ${providerInfo.securitySchemes.length}.`
      );
    } else {
      options?.logCb?.(
        `🆗 All security schemes have been configured successfully.`
      );
    }
  } else {
    options?.logCb?.(`No security schemes found to configure.`);
  }
}
