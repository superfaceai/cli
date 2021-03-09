import { SuperJson } from '@superfaceai/sdk';
import { join as joinPath } from 'path';

import { META_FILE } from '../common/document';
import { userError } from '../common/error';
import { fetchProviderInfo } from '../common/http';
import { formatShellLog, LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import {
  isApiKeySecurity,
  isBasicAuthSecurity,
  isBearerTokenSecurity,
  ProviderStructure,
} from '../common/provider.interfaces';

/**
 * Handle responses from superface registry.
 * It saves new information about provider into super.json.
 */
export function handleProviderResponse(
  superJson: SuperJson,
  response: ProviderStructure,
  options?: { logCb?: LogCallback; warnCb?: LogCallback; force: boolean }
): void {
  if (!response.securitySchemes) {
    return;
  }
  if (response.securitySchemes.length === 0) {
    //FIX: security schemes can be empty?
    return;
  }
  options?.logCb?.(`Installing provider: "${response.name}"`);

  // check existence and warn
  if (
    options?.force === false &&
    superJson.normalized.providers[response.name]
  ) {
    options?.warnCb?.(
      `⚠️  Provider already exists: "${response.name}" (Use flag \`--force/-f\` for overwriting profiles)`
    );

    return;
  }
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
  for (const scheme of response.securitySchemes) {
    if (isApiKeySecurity(scheme)) {
      auth.ApiKey = {
        in: scheme.in,
        name: scheme.name,
        value: `$${response.name.toUpperCase()}_API_KEY`,
      };
    } else if (isBasicAuthSecurity(scheme)) {
      auth.BesicAuth = {
        username: `$${response.name.toUpperCase()}_USERNAME`,
        password: `$${response.name.toUpperCase()}_PASSWORD`,
      };
    } else if (isBearerTokenSecurity(scheme)) {
      auth.Bearer = {
        //FIX: get name from sdk
        name: 'Authorization',
        value: `$${response.name.toUpperCase()}_TOKEN`,
      };
    } else {
      options?.warnCb?.(
        `⚠️  Provider: "${response.name}" contains unknown security scheme`
      );
    }
  }

  // update super.json
  superJson.addProvider(response.name, { auth });
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
): Promise<ProviderStructure> {
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
 * @param provider - provider name specified as argument
 */
export async function installProvider(
  superPath: string,
  providerName: string,
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
    force: boolean;
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

  const providerInfo = await getProviderFromStore(providerName);
  handleProviderResponse(superJson, providerInfo);

  // write new information to super.json
  await OutputStream.writeOnce(superJson.path, superJson.stringified, options);
  options?.logCb?.(
    formatShellLog("echo '<updated super.json>' >", [superJson.path])
  );
}
