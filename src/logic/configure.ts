import {
  assertProviderJson,
  prepareProviderParameters,
  prepareSecurityValues,
  ProfileProviderDefaults,
  ProviderJson,
  SecurityScheme,
  SuperJsonDocument,
} from '@superfaceai/ast';
import {
  loadSuperJson,
  NodeFileSystem,
  normalizeSuperJsonDocument,
  setProfileProvider,
  setProvider,
  swapProfileProviderVariant,
  swapProviderVariant,
} from '@superfaceai/one-sdk';
import { join as joinPath, relative as relativePath } from 'path';

import {
  constructProfileProviderSettings,
  META_FILE,
} from '../common/document';
import { UserError } from '../common/error';
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
 * @returns number of configured security schemes and information about update of the provider settings
 */
export function handleProviderResponse(
  {
    superJson,
    superJsonPath,
    profileId,
    response,
    defaults,
    options,
  }: {
    superJson: SuperJsonDocument;
    superJsonPath: string;
    profileId: ProfileId;
    response: ProviderJson;
    defaults?: ProfileProviderDefaults;
    options?: {
      localMap?: string;
      localProvider?: string;
      force?: boolean;
      mapVariant?: string;
    };
  },
  { logger }: { logger: ILogger }
): { providerUpdated: boolean; numberOfConfigured: number } {
  logger.info('configureProviderSecurity', response.name);

  let parameters: { [key: string]: string } | undefined = undefined;
  if (response.parameters) {
    parameters = prepareProviderParameters(response.name, response.parameters);
  }

  let numberOfConfigured = 0;
  let providerUpdated = false;
  const security = response.securitySchemes
    ? prepareSecurityValues(response.name, response.securitySchemes)
    : [];

  const normalized = normalizeSuperJsonDocument(superJson);
  // update super.json - set provider if not already set or on force
  if (options?.force || !normalized.providers[response.name]) {
    setProvider(
      superJson,
      response.name,
      {
        security,
        parameters,
        file: options?.localProvider
          ? relativePath(superJsonPath, options.localProvider)
          : undefined,
      },
      NodeFileSystem
    );

    numberOfConfigured = security.length;
    providerUpdated = true;
  }

  //constructProfileProviderSettings returns Record<string, ProfileProviderEntry>
  let settings = defaults
    ? { defaults }
    : constructProfileProviderSettings([
        { providerName: response.name, mapVariant: options?.mapVariant },
      ])[response.name];

  if (options?.localMap) {
    if (typeof settings === 'string') {
      settings = { file: relativePath(superJsonPath, options.localMap) };
    } else {
      settings = {
        ...settings,
        file: relativePath(superJsonPath, options.localMap),
      };
    }
  }
  setProfileProvider(
    superJson,
    profileId.id,
    response.name,
    settings,
    NodeFileSystem
  );

  return { providerUpdated, numberOfConfigured };
}

/**
 * Mock the Superface registry API GET call with calls to Store API.
 * Query the provider info
 */
export async function getProviderFromStore(
  providerName: string,
  { logger, userError }: { logger: ILogger; userError: UserError }
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
      mapVariant?: string;
    };
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<void> {
  const superJsonPath = joinPath(superPath, META_FILE);
  const loadedResult = await loadSuperJson(superJsonPath, NodeFileSystem);
  const superJson = loadedResult.match(
    v => v,
    err => {
      logger.warn('errorMessage', err.formatLong());

      return {};
    }
  );

  //Check profile existance
  {
    const normalized = normalizeSuperJsonDocument(superJson);

    if (!normalized.profiles[profileId.id]) {
      throw userError(
        `profile ${profileId.id} not found in "${superJsonPath}".`,
        1
      );
    }
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
    providerInfo = await getProviderFromStore(provider, { logger, userError });
  }

  //Write provider to super.json
  const configureResult = handleProviderResponse(
    {
      superJson,
      superJsonPath,
      profileId,
      response: providerInfo,
      defaults,
      options,
    },
    { logger }
  );

  // write new information to super.json
  await OutputStream.writeOnce(
    superJsonPath,
    JSON.stringify(superJson, undefined, 2),
    options
  );
  logger.info('updateSuperJson', superJsonPath);

  // update .env
  if (options?.updateEnv && providerInfo.securitySchemes) {
    await updateEnv(providerInfo.name, providerInfo.securitySchemes, {
      logger,
    });
  }
  logger.success(
    'profileProviderConfigured',
    providerInfo.name,
    profileId.toString()
  );
  // inform user about installed security schemes if we have updated the provider settings
  if (
    configureResult.providerUpdated &&
    providerInfo.securitySchemes &&
    providerInfo.securitySchemes.length > 0
  ) {
    if (configureResult.numberOfConfigured === 0) {
      logger.warn('noSecurityConfigured');
    } else if (
      configureResult.numberOfConfigured < providerInfo.securitySchemes.length
    ) {
      logger.warn(
        'xOutOfYConfigured',
        configureResult.numberOfConfigured,
        providerInfo.securitySchemes.length
      );
    } else {
      logger.success('allSecurityConfigured');
    }
  } else {
    logger.info('noSecurityFoundOrAlreadyConfigured');
  }

  // inform user about configured parameters if we have updated the provider settings
  {
    const normalized = normalizeSuperJsonDocument(superJson);
    if (
      configureResult.providerUpdated &&
      providerInfo.parameters &&
      providerInfo.parameters.length > 0
    ) {
      logger.info('providerHasParameters', providerInfo.name, superJsonPath);
      for (const parameter of providerInfo.parameters) {
        const superJsonValue =
          normalized.providers[providerInfo.name].parameters[parameter.name];
        if (superJsonValue === undefined) {
          logger.warn(
            'parameterNotConfigured',
            parameter.name,
            superJsonPath,
            parameter.description
          );
        } else {
          logger.success(
            'parameterConfigured',
            parameter.name,
            superJsonValue,
            parameter.description
          );
        }
        if (parameter.default) {
          logger.info('parameterHasDefault', parameter.default);
        }
      }
    }
  }
}

/**
 * Reconfigure provider from local to remote or from remote to local.
 */
export async function reconfigureProvider(
  superJson: SuperJsonDocument,
  providerName: string,
  target: { kind: 'local'; file: string } | { kind: 'remote' }
): Promise<void> {
  // TODO: Possibly do checks whether the remote file exists?
  swapProviderVariant(superJson, providerName, target, NodeFileSystem);
}

/**
 * Reconfigure profile provider from local to remote or from remote to local.
 */
export async function reconfigureProfileProvider(
  superJson: SuperJsonDocument,
  profileId: ProfileId,
  providerName: string,
  target:
    | { kind: 'local'; file: string }
    | { kind: 'remote'; mapVariant?: string; mapRevision?: string }
): Promise<void> {
  // TODO: Possibly do checks whether the remote file exists?
  swapProfileProviderVariant(
    superJson,
    profileId.id,
    providerName,
    target,
    NodeFileSystem
  );
}
