import { ProfileProviderDefaults } from '@superfaceai/ast';
import {
  parseProviderJson,
  ProviderJson,
  SecurityScheme,
  SuperJson,
} from '@superfaceai/one-sdk';
import { ProfileId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import {
  constructProfileProviderSettings,
  META_FILE,
} from '../common/document';
import { userError } from '../common/error';
import { fetchProviderInfo } from '../common/http';
import { readFile, readFileQuiet } from '../common/io';
import { formatShellLog, LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { prepareEnvVariables } from '../templates/env';
import { prepareSecurityValues } from './configure.utils';

export async function updateEnv(
  provider: string,
  securitySchemes: SecurityScheme[],
  options?: { warnCb?: LogCallback }
): Promise<void> {
  //Get .env file
  let envContent = (await readFileQuiet('.env')) || '';
  //Prepare env values from security schemes
  const values = prepareEnvVariables(securitySchemes, provider);

  envContent += values
    .filter((value: string | undefined) => {
      if (!value) {
        options?.warnCb?.(
          `⚠️  Provider: "${provider}" contains unknown security scheme`
        );

        return false;
      }
      //Do not overide existing values
      if (envContent.includes(value.trim())) {
        return false;
      }

      return true;
    })
    .join('');

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
  profileId: ProfileId,
  response: ProviderJson,
  defaults?: ProfileProviderDefaults,
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
    localMap?: string;
    localProvider?: string;
  }
): number {
  options?.logCb?.(`Installing provider: "${response.name}"`);

  const security = response.securitySchemes
    ? prepareSecurityValues(response.name, response.securitySchemes, options)
    : [];
  // update super.json
  superJson.setProvider(response.name, {
    security,
    file: options?.localProvider
      ? superJson.relativePath(options.localProvider)
      : undefined,
  });

  //constructProfileProviderSettings returns Record<string, ProfileProviderEntry>
  let settings = defaults
    ? { defaults }
    : constructProfileProviderSettings([response.name])[response.name];

  if (options?.localMap) {
    if (typeof settings === 'string') {
      settings = { file: superJson.relativePath(options.localMap) };
    } else {
      settings = {
        ...settings,
        file: superJson.relativePath(options.localMap),
      };
    }
  }
  superJson.setProfileProvider(
    profileId.withoutVersion,
    response.name,
    settings
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
  profileId: ProfileId;
  defaults?: ProfileProviderDefaults;
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
    force?: boolean;
    localMap?: string;
    localProvider?: string;
    updateEnv?: boolean;
  };
}): Promise<void> {
  const superJsonPath = joinPath(parameters.superPath, META_FILE);
  const loadedResult = await SuperJson.load(superJsonPath);
  const superJson = loadedResult.match(
    v => v,
    err => {
      parameters.options?.warnCb?.(err.formatLong());

      return new SuperJson({});
    }
  );

  //Check profile existance
  if (!superJson.normalized.profiles[parameters.profileId.withoutVersion]) {
    throw userError(
      `❌ profile ${parameters.profileId.withoutVersion} not found in "${superJsonPath}".`,
      1
    );
  }

  //Load provider info
  let providerInfo: ProviderJson;
  //Load from file
  if (parameters.options?.localProvider) {
    try {
      const file = await readFile(parameters.options.localProvider, {
        encoding: 'utf-8',
      });
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
      `⚠️  Provider already exists: "${providerInfo.name}" (Use flag \`--force/-f\` for overwriting profiles)`
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

/**
 * Reconfigure provider from local to remote or from remote to local.
 */
export async function reconfigureProvider(
  superJson: SuperJson,
  providerName: string,
  target: { kind: 'local'; file: string } | { kind: 'remote' },
  _options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
  }
): Promise<void> {
  // TODO: Possibly do checks whether the remote file exists?
  superJson.swapProviderVariant(providerName, target);
}

/**
 * Reconfigure profile provider from local to remote or from remote to local.
 */
export async function reconfigureProfileProvider(
  superJson: SuperJson,
  profileId: ProfileId,
  providerName: string,
  target:
    | { kind: 'local'; file: string }
    | { kind: 'remote'; mapVariant?: string; mapRevision?: string },
  _options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
  }
): Promise<void> {
  // TODO: Possibly do checks whether the remote file exists?
  superJson.swapProfileProviderVariant(
    profileId.withoutVersion,
    providerName,
    target
  );
}
