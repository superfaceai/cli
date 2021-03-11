import {
  isApiKeySecurity,
  isBasicAuthSecurity,
  isBearerTokenSecurity,
  parseProviderJson,
  ProviderJson,
  SuperJson,
} from '@superfaceai/sdk';
import { join as joinPath } from 'path';

import { META_FILE } from '../common/document';
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
  response: ProviderJson,
  options?: { logCb?: LogCallback; warnCb?: LogCallback; force: boolean }
): number {
  let configured = 0;
  options?.logCb?.(`Installing provider: "${response.name}"`);

  const auth: {
    ApiKey?: Record<string, unknown>;
    BesicAuth?: Record<string, unknown>;
    Bearer?: Record<string, unknown>;
  } = {
    ApiKey: undefined,
    BesicAuth: undefined,
    Bearer: undefined,
  };

  // FIX: multiple same schemes in response
  if (response.securitySchemes) {
    for (const scheme of response.securitySchemes) {
      options?.logCb?.(
        `Configuring ${configured + 1}/${
          response.securitySchemes.length
        } security schemes`
      );
      if (isApiKeySecurity(scheme)) {
        auth.ApiKey = {
          in: scheme.in,
          name: scheme.name,
          value: `$${response.name.toUpperCase()}_API_KEY`,
        };
        configured += 1;
      } else if (isBasicAuthSecurity(scheme)) {
        auth.BesicAuth = {
          username: `$${response.name.toUpperCase()}_USERNAME`,
          password: `$${response.name.toUpperCase()}_PASSWORD`,
        };
        configured += 1;
      } else if (isBearerTokenSecurity(scheme)) {
        auth.Bearer = {
          //FIX: get name from sdk
          name: 'Authorization',
          value: `$${response.name.toUpperCase()}_TOKEN`,
        };
        configured += 1;
      } else {
        options?.warnCb?.(
          `⚠️  Provider: "${response.name}" contains unknown security scheme`
        );
      }
    }
  }

  // update super.json
  superJson.addProvider(response.name, { auth });

  return configured;
}

/**
 * Mock the Superface registry API GET call with calls to Store API.
 * Query the provider info
 */
export async function getProviderFromStore(
  providerName: string,
  options?: {
    logCb?: LogCallback;
  }
): Promise<ProviderJson> {
  options?.logCb?.(`Fetching provider ${providerName} from the Store`);

  try {
    const info = await fetchProviderInfo(providerName);
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
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
    force: boolean;
    path: boolean;
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
  //Load provider info
  let providerInfo: ProviderJson;
  //Load from file
  if (options?.path) {
    try {
      const file = await readFile(provider, { encoding: 'utf-8' });
      // providerInfo = JSON.parse(file) as ProviderJson;
      providerInfo = parseProviderJson(JSON.parse(file));
    } catch (error) {
      throw userError(error, 1);
    }
  } else {
    //Load from server
    providerInfo = await getProviderFromStore(provider);
  }

  // check existence and warn
  if (
    options?.force === false &&
    superJson.normalized.providers[providerInfo.name]
  ) {
    options?.warnCb?.(
      `⚠️  Provider already exists: "${providerInfo.name}" (Use flag \`--force/-f\` for overwriting profiles)`
    );

    return;
  }
  const numOfConfigured = handleProviderResponse(
    superJson,
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
