import {
  isApiKeySecurityScheme,
  isBasicAuthSecurityScheme,
  isBearerTokenSecurityScheme,
  isDigestSecurityScheme,
  parseProviderJson,
  ProfileProviderDefaults,
  ProviderJson,
  SecurityScheme,
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
import { exists, readFile } from '../common/io';
import { formatShellLog, LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { envVariable } from '../templates/env';

export async function updateEnv(
  provider: string,
  securitySchemes: SecurityScheme[],
  options?: { warnCb?: LogCallback }
): Promise<void> {
  let envContent = '';
  //Get .env file
  if (await exists('.env')) {
    envContent = (await readFile('.env')).toString();
  }
  //Get security values of installed provider
  const envProviderName = provider.replace('-', '_').toUpperCase();

  for (const scheme of securitySchemes) {
    let value: string | undefined;
    if (isApiKeySecurityScheme(scheme)) {
      value = envVariable(`${envProviderName}_API_KEY`, '');
    } else if (isBasicAuthSecurityScheme(scheme)) {
      value = envVariable(`${envProviderName}_USERNAME`, '');
      value = envVariable(`${envProviderName}_PASSWORD`, '');
    } else if (isBearerTokenSecurityScheme(scheme)) {
      value = envVariable(`${envProviderName}_TOKEN`, '');
    } else if (isDigestSecurityScheme(scheme)) {
      value = envVariable(`${envProviderName}_DIGEST`, '');
    } else {
      options?.warnCb?.(
        `⚠️  Provider: "${provider}" contains unknown security scheme`
      );
    }
    //Do not overide existing values
    if (value && !envContent.includes(value.trim())) {
      envContent += value;
    }
  }
  //Write .env file
  await OutputStream.writeOnce('.env', envContent);
}
/**
 * Handle responses from superface registry.
 * It saves new information about provider into super.json.
 * @returns number of configured security schemes
 */
export function handleProviderResponse(
  superJson: SuperJson,
  profileId: string,
  response: ProviderJson,
  defaults?: ProfileProviderDefaults,
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
      //Char - is not allowed in env variables so replace it with _
      const envProviderName = response.name.replace('-', '_').toUpperCase();
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
    defaults || constructProfileProviderSettings([response.name])[response.name]
  );

  return security.length;
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
export async function installProvider(parameters: {
  superPath: string;
  provider: string;
  profileId: string;
  defaults?: ProfileProviderDefaults;
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
    force?: boolean;
    local: boolean;
    updateEnv?: boolean;
  };
}): Promise<void> {
  const loadedResult = await SuperJson.load(
    joinPath(parameters.superPath, META_FILE)
  );
  const superJson = loadedResult.match(
    v => v,
    err => {
      parameters.options?.warnCb?.(err);

      return new SuperJson({});
    }
  );
  //Check if there is a version inside profile id
  parameters.profileId = parameters.profileId.split('@')[0];

  //Check profile existance
  if (!superJson.normalized.profiles[parameters.profileId]) {
    throw userError(
      `❌ profile ${parameters.profileId} not found in ${parameters.superPath}. Forgot to install?`,
      1
    );
  }

  //Load provider info
  let providerInfo: ProviderJson;
  //Load from file
  if (parameters.options?.local) {
    try {
      const file = await readFile(parameters.provider, { encoding: 'utf-8' });
      providerInfo = parseProviderJson(JSON.parse(file));
    } catch (error) {
      throw userError(error, 1);
    }
  } else {
    //Load from server
    providerInfo = await getProviderFromStore(parameters.provider);
  }

  // Check existence and warn
  if (
    parameters.options?.force !== true &&
    superJson.normalized.providers[providerInfo.name]
  ) {
    parameters.options?.warnCb?.(
      `⚠️  Provider already exists: "${providerInfo.name}"(Use flag \`--force/-f\` for overwriting profiles)`
    );

    return;
  }

  //Write provider to super.json
  const numOfConfigured = handleProviderResponse(
    superJson,
    parameters.profileId,
    providerInfo,
    parameters.defaults,
    parameters.options
  );

  // write new information to super.json
  await OutputStream.writeOnce(
    superJson.path,
    superJson.stringified,
    parameters.options
  );
  parameters.options?.logCb?.(
    formatShellLog("echo '<updated super.json>' >", [superJson.path])
  );

  // update .env
  if (parameters.options?.updateEnv && providerInfo.securitySchemes) {
    await updateEnv(providerInfo.name, providerInfo.securitySchemes, {
      warnCb: parameters.options.warnCb,
    });
  }
  if (providerInfo.securitySchemes && providerInfo.securitySchemes.length > 0) {
    // inform user about instlaled security schemes
    if (numOfConfigured === 0) {
      parameters.options?.logCb?.(
        `❌ No security schemes have been configured.`
      );
    } else if (numOfConfigured < providerInfo.securitySchemes.length) {
      parameters.options?.logCb?.(
        `⚠️ Some security schemes have been configured. Configured ${numOfConfigured} out of ${providerInfo.securitySchemes.length}.`
      );
    } else {
      parameters.options?.logCb?.(
        `🆗 All security schemes have been configured successfully.`
      );
    }
  } else {
    parameters.options?.logCb?.(`No security schemes found to configure.`);
  }
}
