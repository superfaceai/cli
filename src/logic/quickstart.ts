import {
  BackoffKind,
  isApiKeySecurityValues,
  isBasicAuthSecurityValues,
  isBearerTokenSecurityValues,
  isDigestSecurityValues,
  isValidDocumentName,
  isValidVersionString,
  OnFail,
  RetryPolicy,
  SecurityValues,
} from '@superfaceai/ast';
import {
  loadSuperJson,
  mergeProfileDefaults,
  META_FILE,
  NodeFileSystem,
  normalizeSuperJsonDocument,
  SUPERFACE_DIR,
} from '@superfaceai/one-sdk';
import { getProfileUsecases, parseProfile, Source } from '@superfaceai/parser';
import { bold } from 'chalk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { developerError, UserError } from '../common/error';
import { fetchProviders, getServicesUrl } from '../common/http';
import { exists, readFile } from '../common/io';
import { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { IPackageManager } from '../common/package-manager';
import { NORMALIZED_CWD_PATH } from '../common/path';
import { ProfileId } from '../common/profile';
import { envVariable } from '../templates/env';
import { findLocalProfileSource } from './check.utils';
import { installProvider } from './configure';
import { initSuperface } from './init';
import { detectSuperJson, installProfiles } from './install';
import { profileExists, providerExists } from './quickstart.utils';

export async function interactiveInstall(
  profileArg: string,
  {
    logger,
    pm,
    userError,
  }: { logger: ILogger; pm: IPackageManager; userError: UserError }
): Promise<void> {
  const [profileIdStr, version] = profileArg.split('@');
  const profilePathParts = profileIdStr.split('/');
  const profileId = ProfileId.fromScopeName(
    profilePathParts[0],
    profilePathParts[profilePathParts.length - 1]
  );

  if (!isValidDocumentName(profileId.name)) {
    logger.error('invalidProfileName', profileId.name);

    return;
  }
  if (version && !isValidVersionString(version)) {
    logger.error('invalidProfileVersion', version);

    return;
  }
  let envContent = '';
  //Super.json path
  let superPath = await detectSuperJson(process.cwd());
  if (!superPath) {
    //Init SF
    logger.success('initSuperface');
    await initSuperface(
      {
        appPath: NORMALIZED_CWD_PATH,
        initialDocument: { profiles: {}, providers: {} },
      },
      { logger }
    );
    superPath = SUPERFACE_DIR;
  }

  //Load super.json (for checks)
  const superJsonPath = joinPath(superPath, META_FILE);
  const loaded = await loadSuperJson(superJsonPath, NodeFileSystem);
  let superJson = loaded.unwrap();

  logger.success('installProfile', profileArg);

  let installProfile = true;
  //Override existing profile
  if (
    await profileExists(superJson, superJsonPath, { id: profileId, version })
  ) {
    if (
      !(await confirmPrompt(
        `Profile "${profileId.id}" already exists.\nDo you want to override it?:`
      ))
    )
      installProfile = false;
  }
  //Install profile
  if (installProfile) {
    await installProfiles(
      {
        superPath,
        requests: [
          {
            kind: 'store',
            profileId,
            version: version,
          },
        ],
        options: {
          force: true,
        },
      },
      { logger, userError }
    );
    const superJsonPath = joinPath(superPath, META_FILE);
    //Reload super.json
    superJson = (await loadSuperJson(superJsonPath, NodeFileSystem)).unwrap();
  }
  //Ask for providers
  const possibleProviders = (await fetchProviders(profileArg)).map(p => p.name);

  const priorityToString: Map<number, string> = new Map([
    [1, 'primary'],
    [2, 'secondary'],
    [3, 'third'],
    [4, 'fourth'],
    [5, 'fifth'],
  ]);
  const providersWithPriority: { name: string; priority: number }[] = [];
  let priority = 1;
  let exit = false;
  while (!exit) {
    const choices: {
      name: string;
      value: { name?: string; priority?: number; exit: boolean };
    }[] = possibleProviders
      //Remove already configured and mock provider
      .filter(
        provider =>
          !providersWithPriority.find(
            providerWithPriority => providerWithPriority.name === provider
          ) && provider !== 'mock'
      )
      .map(provider => {
        return {
          name: provider,
          value: { name: provider, priority, exit: false },
        };
      });
    //Add exit choice
    choices.push({
      name: bold('<<done>>'),
      value: { name: undefined, priority: undefined, exit: true },
    });

    const providerResponse: {
      provider: { name: string; priority: number; exit: boolean };
    } = await inquirer.prompt({
      name: 'provider',
      message:
        priority === 1
          ? `Select providers you would like to use. You can end selection by choosing "<<done>>".\nSelect ${
              priorityToString.get(priority) || priority
            } provider:`
          : `Select ${priorityToString.get(priority) || priority} provider:`,
      type: 'list',
      choices,
    });
    if (providerResponse.provider.exit) {
      exit = true;
      continue;
    }
    providersWithPriority.push({
      name: providerResponse.provider.name,
      priority: providerResponse.provider.priority,
    });

    if (choices.length === 2) {
      exit = true;
    }
    priority++;
  }

  //Configure providers
  logger.success('installMultipleProviders');
  const providersToInstall: string[] = [];
  for (const provider of providersWithPriority) {
    //Override existing provider
    if (providerExists(superJson, provider.name)) {
      if (
        !(await confirmPrompt(
          `Provider "${provider.name}" already exists.\nDo you want to override it?:`
        ))
      ) {
        continue;
      }
    }
    providersToInstall.push(provider.name);
  }

  //Get installed usecases
  const profileSource = await findLocalProfileSource(
    superJson,
    superJsonPath,
    profileId,
    version
  );
  if (!profileSource) {
    throw developerError('Profile source not found after installation', 1);
  }
  const profileAst = parseProfile(
    new Source(profileSource.source, profileId.id)
  );
  const profileUsecases = getProfileUsecases(profileAst);
  //Check usecase
  if (profileUsecases.length === 0) {
    throw userError(
      'Profile AST does not contain any use cases - misconfigured profile file',
      1
    );
  }

  //Select usecase to configure
  let selectedUseCase: string | undefined = undefined;
  if (profileUsecases.length > 1) {
    const useCaseResponse: { useCase: string } = await inquirer.prompt({
      name: 'useCase',
      message: `Installed profile "${profileId.id}" has more than one use case.\nSelect one you want to configure:`,
      type: 'list',
      choices: profileUsecases.map(usecase => usecase.name),
    });
    selectedUseCase = useCaseResponse.useCase;
  } else {
    selectedUseCase = profileUsecases[0].name;
  }

  //Configure provider failover
  //de duplicate providers to install and providers in super json
  let normalized = normalizeSuperJsonDocument(superJson);
  const allProviders = providersToInstall.concat(
    Object.keys(normalized.providers).filter(
      (provider: string) => providersToInstall.indexOf(provider) < 0
    )
  );
  //TODO: check also already installed providers - distinct with providers to install
  if (allProviders.length > 1) {
    if (
      await confirmPrompt(
        'You have selected more than one provider.\nDo you want to enable provider failover:',
        { default: true }
      )
    ) {
      //Add provider failover
      mergeProfileDefaults(superJson, profileId.id, {
        [selectedUseCase]: { providerFailover: true },
      });
      await OutputStream.writeOnce(
        superJsonPath,
        JSON.stringify(superJson, undefined, 2),
        {
          force: true,
        }
      );
    }
  }

  //Configure retry policies && install providers
  for (const provider of providersToInstall) {
    //Install provider
    await installProvider(
      {
        superPath,
        provider,
        profileId,
        defaults: {
          [selectedUseCase]: {
            retryPolicy: await selectRetryPolicy(provider, selectedUseCase),
          },
        },
        options: {
          force: true,
        },
      },
      { logger, userError }
    );
  }

  //Reload super.json
  superJson = (await loadSuperJson(superJsonPath, NodeFileSystem)).unwrap();
  normalized = normalizeSuperJsonDocument(superJson);
  //Get installed providers
  const installedProviders = normalized.providers;
  //Ask for provider security
  logger.success('configureMultipleProviderSecurity');

  //Get .env file
  if (await exists('.env')) {
    envContent = await readFile('.env', { encoding: 'utf-8' });
  }
  let selectedSchema: SecurityValues;
  for (const provider of Object.keys(installedProviders)) {
    //Do not change provider that user dont want to overide from instaledProviders array
    if (!providersToInstall.includes(provider)) {
      continue;
    }
    logger.info('configureProviderSecurity', provider);
    //Select security schema
    if (
      installedProviders[provider].security &&
      installedProviders[provider].security.length > 0
    ) {
      //If thre is only one schema use it
      if (installedProviders[provider].security.length === 1) {
        selectedSchema = installedProviders[provider].security[0];
      } else {
        //Let user select schema
        selectedSchema = await selectSecuritySchema(
          provider,
          installedProviders[provider].security
        );
      }

      //Set env variables for selected schema
      envContent = await resolveSecurityEnvValues(
        provider,
        selectedSchema,
        envContent,
        { logger }
      );
    } else {
      logger.success('noAuthProvider', provider);
    }
  }
  //Check/init package-manager
  if (!(await pm.packageJsonExists())) {
    logger.warn('packageJsonNotFound');
    //Prompt user for package manager initialization
    const response: {
      pm: 'yarn' | 'npm' | 'exit';
    } = await inquirer.prompt({
      name: 'pm',
      message:
        'Do you want to initialize package manager ("yes" flag will be used)?',
      type: 'list',
      choices: [
        { name: 'Yarn (yarn must be installed)', value: 'yarn' },
        { name: 'NPM', value: 'npm' },
        { name: 'Exit installation', value: 'exit' },
      ],
    });

    if (response.pm === 'exit') {
      return;
    }
    logger.success('initPm', response.pm);

    await pm.init(response.pm);
  }
  //Install SDK
  logger.success('installPackage', '@superfaceai/one-sdk');
  await pm.installPackage('@superfaceai/one-sdk');

  //Prompt user for dotenv installation
  if (
    await confirmPrompt(
      'Superface CLI would like to install dotenv package (https://github.com/motdotla/dotenv#readme).\nThis package is used to load superface secrets from .env file. You can use different one or install it manually later.\nWould you like to install it now?:',
      { default: true }
    )
  ) {
    logger.success('installPackage', 'dotenv');
    await pm.installPackage('dotenv');
  }

  //Prompt user for optional SDK token
  logger.success('configurePackage', '@superfaceai/one-sdk');

  const tokenEnvName = 'SUPERFACE_SDK_TOKEN';

  if (!envContent.includes(`${tokenEnvName}=`)) {
    const tokenResponse: { token: string | undefined } = await inquirer.prompt({
      name: 'token',
      message:
        '(Optional) Enter your SDK token generated at https://superface.ai:',
      type: 'password',
      validate: input => {
        const tokenRegexp = /^(sfs)_([^_]+)_([0-9A-F]{8})$/i;
        if (!input) {
          return true;
        }
        if (!tokenRegexp.test(input)) {
          return 'Entered value has unexpected format. Please try again';
        }

        return true;
      },
    });

    if (tokenResponse.token) {
      envContent += envVariable(tokenEnvName, tokenResponse.token);
      logger.success('configuredWithSdkToken', tokenEnvName);
    } else {
      logger.success('configuredWithoutSdkToken');
    }
  }

  //Write .env file
  await OutputStream.writeOnce('.env', envContent);

  logger.success('superfaceConfigureSuccess');

  //Lead to docs page
  logger.success(
    'capabilityDocsUrl',
    new URL(profileId.id, getServicesUrl()).href
  );
}

async function selectRetryPolicy(
  provider: string,
  selectedUseCase: string
): Promise<RetryPolicy> {
  //Select retry policy
  const policyResponse: { policy: OnFail } = await inquirer.prompt({
    name: 'policy',
    message: `Select a failure policy for provider ${provider} and use case: ${selectedUseCase}:`,
    type: 'list',
    choices: [
      { name: 'None', value: OnFail.NONE },
      { name: 'Circuit Breaker', value: OnFail.CIRCUIT_BREAKER },
    ],
  });

  if (policyResponse.policy === OnFail.NONE) {
    return { kind: OnFail.NONE };
  } else if (policyResponse.policy === OnFail.CIRCUIT_BREAKER) {
    //You want to customize?
    if (
      await confirmPrompt(
        'Do you want to customize circuit breaker parameters?:',
        { default: false }
      )
    ) {
      return {
        kind: OnFail.CIRCUIT_BREAKER,
        ...(await selectCircuitBreakerValues(provider, selectedUseCase)),
      };
    } else {
      return {
        kind: OnFail.CIRCUIT_BREAKER,
      };
    }
  }

  throw developerError('Unreachable', 1);
}

async function selectCircuitBreakerValues(
  provider: string,
  useCase: string
): Promise<{
  maxContiguousRetries: number;
  requestTimeout: number;
  backoff: {
    kind: BackoffKind.EXPONENTIAL;
    start: number;
    factor: number;
  };
}> {
  const maxContiguousRetries: {
    maxContiguousRetries: number;
  } = await inquirer.prompt({
    name: 'maxContiguousRetries',
    message: `Enter value of maximum contiguous retries for provider ${provider} and use case: ${useCase}:`,
    type: 'number',
  });
  const requestTimeout: { requestTimeout: number } = await inquirer.prompt({
    name: 'requestTimeout',
    message: `Enter request timeout for provider ${provider} and use case: ${useCase} (in miliseconds):`,
    type: 'number',
  });

  return {
    maxContiguousRetries: maxContiguousRetries.maxContiguousRetries,
    requestTimeout: requestTimeout.requestTimeout,
    backoff: {
      ...(await selectExponentialBackoffValues(provider, useCase)),
    },
  };
}

async function selectExponentialBackoffValues(
  provider: string,
  useCase: string
): Promise<{ kind: BackoffKind.EXPONENTIAL; start: number; factor: number }> {
  const start: { start: number } = await inquirer.prompt({
    name: 'start',
    message: `Enter initial value of exponential backoff for provider ${provider} and use case: ${useCase} (in miliseconds):`,
    type: 'number',
  });
  const factor: { factor: number } = await inquirer.prompt({
    name: 'factor',
    message: `Enter value of exponent in exponential backoff for provider ${provider} and use case: ${useCase} (in miliseconds):`,
    type: 'number',
  });

  return {
    kind: BackoffKind.EXPONENTIAL,
    factor: factor.factor,
    start: start.start,
  };
}

async function getPromptedValue(
  {
    provider,
    authType,
    name,
    envVariableName,
    envContent,
  }: {
    provider: string;
    authType: 'api key' | 'http' | 'bearer';
    name: string;
    envVariableName: string;
    envContent: string;
  },
  { logger }: { logger: ILogger }
): Promise<string> {
  if (!envVariableName.startsWith('$')) {
    logger.warn('unexpectedSecurityValue', envVariableName, provider, authType);

    return envContent;
  }
  const variableName = envVariableName.substring(1);
  if (envContent.includes(`${variableName}=`)) {
    //Do we want to override?
    if (
      await confirmPrompt(
        `Value of ${variableName} for ${provider} is already set.\nDo you want to override it?:`
      )
    ) {
      //Delete set row
      envContent = envContent
        .split('\n')
        .filter(row => !row.includes(`${variableName}=`))
        .join('\n');
    } else {
      return envContent;
    }
  }

  const response: { value: string } = await inquirer.prompt({
    name: 'value',
    message: `Enter ${name} of ${authType} security for ${provider}. This value will be stored locally in .env file:`,
    type: 'password',
  });

  return (envContent += envVariable(variableName, response.value));
}

async function resolveSecurityEnvValues(
  provider: string,
  schema: SecurityValues,
  envFile: string,
  { logger }: { logger: ILogger }
): Promise<string> {
  let newEnvContent = envFile;
  if (isApiKeySecurityValues(schema)) {
    newEnvContent = await getPromptedValue(
      {
        provider,
        authType: 'api key',
        name: 'apikey',
        envVariableName: schema.apikey,
        envContent: newEnvContent,
      },
      {
        logger,
      }
    );
    //Digest and basic have same structure
  } else if (
    isBasicAuthSecurityValues(schema) ||
    isDigestSecurityValues(schema)
  ) {
    newEnvContent = await getPromptedValue(
      {
        provider,
        authType: 'http',
        name: 'username',
        envVariableName: schema.username,
        envContent: newEnvContent,
      },
      { logger }
    );
    newEnvContent = await getPromptedValue(
      {
        provider,
        authType: 'http',
        name: 'password',
        envVariableName: schema.password,
        envContent: newEnvContent,
      },
      { logger }
    );
  } else if (isBearerTokenSecurityValues(schema)) {
    newEnvContent = await getPromptedValue(
      {
        provider,
        authType: 'bearer',
        name: 'token',
        envVariableName: schema.token,
        envContent: newEnvContent,
      },
      { logger }
    );
  } else {
    logger.warn('unknownSecurityType', provider);
  }

  return newEnvContent;
}

async function selectSecuritySchema(
  provider: string,
  schemas: SecurityValues[]
): Promise<SecurityValues> {
  const schemaResponse: { schema: SecurityValues } = await inquirer.prompt({
    name: 'schema',
    message: `Select a security schema for ${provider}:`,
    type: 'list',
    choices: schemas.map(s => {
      return { name: s.id, value: s };
    }),
  });

  return schemaResponse.schema;
}

async function confirmPrompt(
  message?: string,
  options?: { default?: boolean }
): Promise<boolean> {
  const prompt: { continue: boolean } = await inquirer.prompt({
    name: 'continue',
    message: message
      ? `${message}`
      : 'Do you want to continue with installation?:',
    type: 'confirm',
    default: options?.default || false,
  });

  return prompt.continue;
}
