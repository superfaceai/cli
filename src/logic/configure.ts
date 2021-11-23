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
import { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { prepareEnvVariables } from '../templates/env';

export async function updateEnv(
  provider: string,
  securitySchemes: SecurityScheme[],
  { logger }: { logger: ILogger }
): Promise<void> {
  //Get .env file
  let envContent = (await readFileQuiet('.env')) || '';
  //Prepare env values from security schemes
  const values = prepareEnvVariables(securitySchemes, provider);

  envContent += values
    .filter((value: string | undefined) => {
      if (!value) {
        logger.warn('unknownSecurityScheme', provider);

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
  {
    superJson,
    profileId,
    response,
    defaults,
    options,
  }: {
    superJson: SuperJson;
    profileId: ProfileId;
    response: ProviderJson;
    defaults?: ProfileProviderDefaults;
    options?: {
      localMap?: string;
      localProvider?: string;
    };
  },
  { logger }: { logger: ILogger }
): number {
  logger.info('configureProviderSecurity', response.name);

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
  providerName: string,
  { logger }: { logger: ILogger }
): Promise<ProviderJson> {
  logger.info('fetchProvider', providerName);

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
export async function installProvider(
  {
    superPath,
    provider,
    profileId,
    defaults,
    options,
  }: {
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
  },
  { logger }: { logger: ILogger }
): Promise<void> {
  const superJsonPath = joinPath(superPath, META_FILE);
  const loadedResult = await SuperJson.load(superJsonPath);
  const superJson = loadedResult.match(
    v => v,
    err => {
      logger.warn('errorMessage', err.formatLong());

      return new SuperJson({});
    }
  );

  //Check profile existance
  if (!superJson.normalized.profiles[profileId.id]) {
    throw userError(
      `❌ profile ${profileId.id} not found in "${superJsonPath}".`,
      1
    );
  }

  //Load provider info
  let providerInfo: ProviderJson;
  //Load from file
  if (options?.localProvider) {
    try {
      const file = await readFile(options.localProvider, {
        encoding: 'utf-8',
      });
      providerInfo = assertProviderJson(JSON.parse(file));
    } catch (error) {
      throw userError(error, 1);
    }
  } else {
    //Load from server
    providerInfo = await getProviderFromStore(provider, { logger });
  }

  // Check existence and warn
  if (
    options?.force !== true &&
    superJson.normalized.providers[providerInfo.name]
  ) {
    logger.warn('providerAlreadyExists', providerInfo.name);

    return;
  }

  //Write provider to super.json
  const numOfConfigured = handleProviderResponse(
    {
      superJson,
      profileId,
      response: providerInfo,
      defaults,
      options,
    },
    { logger }
  );

  // write new information to super.json
  await OutputStream.writeOnce(superJson.path, superJson.stringified, options);
  logger.info('updateSuperJson', superJson.path);

  // update .env
  if (options?.updateEnv && providerInfo.securitySchemes) {
    await updateEnv(providerInfo.name, providerInfo.securitySchemes, {
      logger,
    });
  }
  if (providerInfo.securitySchemes && providerInfo.securitySchemes.length > 0) {
    // inform user about instlaled security schemes
    if (numOfConfigured === 0) {
      logger.warn('noSecurityConfigured');
    } else if (numOfConfigured < providerInfo.securitySchemes.length) {
      logger.warn(
        'xOutOfYConfigured',
        numOfConfigured,
        providerInfo.securitySchemes.length
      );
    } else {
      logger.success('allSecurityConfigured');
    }
  } else {
    logger.info('noSecurityFound');
  }
  // inform user about configured parameters
  if (providerInfo.parameters && providerInfo.parameters.length > 0) {
    logger.info('providerHasParameters', providerInfo.name, superJson.path);
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
        logger.warn(
          'parameterNotConfigured',
          parameter.name,
          description,
          superJson.path
        );
      } else {
        logger.success(
          'parameterConfigured',
          parameter.name,
          description,
          superJsonValue
        );
      }
      if (parameter.default) {
        logger.info('parameterHasDefault', parameter.default);
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
