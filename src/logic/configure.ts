import {
  assertProviderJson,
  prepareProviderParameters,
  prepareSecurityValues,
  ProfileProviderDefaults,
  ProviderJson,
  SecurityScheme,
} from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import {
  constructProfileProviderSettings,
  META_FILE,
} from '../common/document';
import { userError } from '../common/error';
import { fetchProviderInfo } from '../common/http';
import { readFile, readFileQuiet } from '../common/io';
import { Logger } from '../common/log';
import { messages } from '../common/messages';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { prepareEnvVariables } from '../templates/env';

export async function updateEnv(
  provider: string,
  securitySchemes: SecurityScheme[]
): Promise<void> {
  //Get .env file
  let envContent = (await readFileQuiet('.env')) || '';
  //Prepare env values from security schemes
  const values = prepareEnvVariables(securitySchemes, provider);

  envContent += values
    .filter((value: string | undefined) => {
      if (!value) {
        Logger.warn(`Provider: "${provider}" contains unknown security scheme`);

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
    localMap?: string;
    localProvider?: string;
  }
): number {
  Logger.info(messages.install.provider(response.name));

  let parameters: { [key: string]: string } | undefined = undefined;
  if (response.parameters) {
    parameters = prepareProviderParameters(response.name, response.parameters);
  }

  const security = response.securitySchemes
    ? prepareSecurityValues(response.name, response.securitySchemes)
    : [];

  // update super.json
  superJson.setProvider(response.name, {
    security,
    parameters,
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
  superJson.setProfileProvider(profileId.id, response.name, settings);

  return security.length;
}

/**
 * Mock the Superface registry API GET call with calls to Store API.
 * Query the provider info
 */
export async function getProviderFromStore(
  providerName: string
): Promise<ProviderJson> {
  Logger.info(messages.fetch.provider(providerName));

  try {
    const info = await fetchProviderInfo(providerName);

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
      Logger.warn(err.formatLong());

      return new SuperJson({});
    }
  );

  //Check profile existance
  if (!superJson.normalized.profiles[parameters.profileId.id]) {
    throw userError(
      `❌ profile ${parameters.profileId.id} not found in "${superJsonPath}".`,
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
      providerInfo = assertProviderJson(JSON.parse(file));
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
    Logger.warn(
      `Provider ${providerInfo.name} already exists (Use flag \`--force/-f\` for overwriting profiles)`
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
  Logger.info(messages.common.updateSuperJson(superJson.path));

  // update .env
  if (parameters.options?.updateEnv && providerInfo.securitySchemes) {
    await updateEnv(providerInfo.name, providerInfo.securitySchemes);
  }
  if (providerInfo.securitySchemes && providerInfo.securitySchemes.length > 0) {
    // inform user about instlaled security schemes
    if (numOfConfigured === 0) {
      Logger.warn(`No security schemes have been configured.`);
    } else if (numOfConfigured < providerInfo.securitySchemes.length) {
      Logger.warn(
        `Some security schemes have been configured. Configured ${numOfConfigured} out of ${providerInfo.securitySchemes.length}.`
      );
    } else {
      Logger.success(`All security schemes have been configured successfully.`);
    }
  } else {
    Logger.info(`No security schemes found to configure.`);
  }
  // inform user about configured parameters
  if (providerInfo.parameters && providerInfo.parameters.length > 0) {
    Logger.info(
      `Provider ${providerInfo.name} has integration parameters that must be configured. You can configure them in super.json on path: ${superJson.path} or set the environment variables as defined below.`
    );
    for (const parameter of providerInfo.parameters) {
      let description = '';
      if (parameter.description) {
        description = ` with description "${parameter.description}"`;
      }

      const superJsonValue =
        superJson.normalized.providers[providerInfo.name].parameters[
          parameter.name
        ];
      if (superJsonValue === undefined) {
        Logger.warn(
          `Parameter ${parameter.name}${description} has not been configured.\nPlease, configure this parameter manualy in super.json on path: ${superJson.path}`
        );
      } else {
        Logger.success(
          `Parameter ${parameter.name}${description} has been configured to use value of environment value "${superJsonValue}".\nPlease, configure this environment value.`
        );
      }
      if (parameter.default) {
        Logger.info(
          `If you do not set the variable, the default value "${parameter.default}" will be used.`
        );
      }
    }
  }
}

/**
 * Reconfigure provider from local to remote or from remote to local.
 */
export async function reconfigureProvider(
  superJson: SuperJson,
  providerName: string,
  target: { kind: 'local'; file: string } | { kind: 'remote' }
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
    | { kind: 'remote'; mapVariant?: string; mapRevision?: string }
): Promise<void> {
  // TODO: Possibly do checks whether the remote file exists?
  superJson.swapProfileProviderVariant(profileId.id, providerName, target);
}
