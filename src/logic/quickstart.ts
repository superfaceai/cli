import { isValidDocumentName, isValidVersionString } from '@superfaceai/ast';
import {
  BackoffKind,
  isApiKeySecurityValues,
  isBasicAuthSecurityValues,
  isBearerTokenSecurityValues,
  isDigestSecurityValues,
  META_FILE,
  OnFail,
  RetryPolicy,
  SecurityValues,
  SUPERFACE_DIR,
  SuperJson,
} from '@superfaceai/one-sdk';
import { getProfileUsecases } from '@superfaceai/parser';
import { bold } from 'chalk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { developerError, userError } from '../common/error';
import { fetchProviders, getStoreUrl } from '../common/http';
import { exists, readFile } from '../common/io';
import { LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { PackageManager } from '../common/package-manager';
import { envVariable } from '../templates/env';
import { installProvider } from './configure';
import { initSuperface } from './init';
import { detectSuperJson, installProfiles } from './install';
import {
  loadProfileAst,
  profileExists,
  providerExists,
} from './quickstart.utils';

export async function interactiveInstall(
  profileArg: string,
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
    successCb?: LogCallback;
  }
): Promise<void> {
  const [profileId, version] = profileArg.split('@');
  const profilePathParts = profileId.split('/');
  const profile = profilePathParts[profilePathParts.length - 1];
  const scope = profilePathParts[0];

  if (!isValidDocumentName(profile)) {
    options?.warnCb?.(`Invalid profile name: ${profile}`);

    return;
  }
  if (version && !isValidVersionString(version)) {
    options?.warnCb?.(`Invalid profile version: ${version}`);

    return;
  }
  let envContent = '';
  //Super.json path
  let superPath = await detectSuperJson(process.cwd());
  if (!superPath) {
    //Init SF
    options?.successCb?.('Initializing superface directory');
    await initSuperface(
      './',
      { profiles: {}, providers: {} },
      { logCb: options?.logCb }
    );
    superPath = SUPERFACE_DIR;
  }

  //Load super.json (for checks)
  let superJson = (
    await SuperJson.load(joinPath(superPath, META_FILE))
  ).unwrap();

  options?.successCb?.(`\nInitializing ${profileArg}`);

  let installProfile = true;
  //Override existing profile
  if (await profileExists(superJson, { profile, scope, version })) {
    if (
      !(await confirmPrompt(
        `Profile "${scope}/${profile}" already exists.\nDo you want to override it?:`
      ))
    )
      installProfile = false;
  }
  //Install profile
  if (installProfile) {
    await installProfiles(
      superPath,
      [
        {
          kind: 'store',
          profileId,
          version: version,
        },
      ],
      {
        logCb: options?.logCb,
        warnCb: options?.warnCb,
        force: true,
      }
    );
    //Reload super.json
    superJson = (await SuperJson.load(joinPath(superPath, META_FILE))).unwrap();
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
  options?.successCb?.(`\nInstalling providers`);
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
  const profileAst = await loadProfileAst(superJson, {
    profile,
    scope,
    version,
  });
  if (!profileAst) {
    throw developerError('Profile AST not found after installation', 1);
  }
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
      message: `Installed profile "${profileId}" has more than one use case.\nSelect one you want to configure:`,
      type: 'list',
      choices: profileUsecases.map(usecase => usecase.name),
    });
    selectedUseCase = useCaseResponse.useCase;
  } else {
    selectedUseCase = profileUsecases[0].name;
  }

  //Configure provider failover
  //de duplicate providers to install and providers in super json
  const allProviders = providersToInstall.concat(
    Object.keys(superJson.normalized.providers).filter(
      (provider: string) => providersToInstall.indexOf(provider) < 0
    )
  );
  //TODO: check also already installed providers - distinct with providers to install
  if (allProviders.length > 1) {
    if (
      await confirmPrompt(
        `You have selected more than one provider.\nDo you want to enable provider failover:`,
        { default: true }
      )
    ) {
      //Add provider failover
      superJson.addProfileDefaults(profileId, {
        [selectedUseCase]: { providerFailover: true },
      });
      await OutputStream.writeOnce(superJson.path, superJson.stringified, {
        force: true,
      });
    }
  }

  //Configure retry policies && install providers
  for (const provider of providersToInstall) {
    //Install provider
    await installProvider(
      superPath,
      provider,
      profileId,
      {
        defaults: {
          [selectedUseCase]: {
            retryPolicy: await selectRetryPolicy(provider, selectedUseCase),
          },
        },
      },
      {
        logCb: options?.logCb,
        warnCb: options?.warnCb,
        force: true,
        local: false,
      }
    );
  }

  //Reload super.json
  superJson = (await SuperJson.load(joinPath(superPath, META_FILE))).unwrap();
  //Get installed providers
  const installedProviders = superJson.normalized.providers;
  //Ask for provider security
  options?.successCb?.(`\nConfiguring providers security`);

  //Get .env file
  if (await exists('.env')) {
    envContent = (await readFile('.env')).toString();
  }
  let selectedSchema: SecurityValues;
  for (const provider of Object.keys(installedProviders)) {
    //Do not change provider that user dont want to overide from instaledProviders array
    if (!providersToInstall.includes(provider)) {
      continue;
    }
    options?.logCb?.(`\nConfiguring "${provider}" security`);
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
        {
          logCb: options?.logCb,
          warnCb: options?.warnCb,
        }
      );
    } else {
      options?.successCb?.(
        `\nProvider "${provider}" can be used without authentication`
      );
    }
  }
  //Check/init package-manager
  if (!(await PackageManager.packageJsonExists({ warnCb: options?.warnCb }))) {
    options?.warnCb?.(
      `Package.json not found in current directory "${process.cwd()}".`
    );
    //Prompt user for package manager initialization
    const response: {
      pm: 'yarn' | 'npm' | 'exit';
    } = await inquirer.prompt({
      name: 'pm',
      message:
        'Do you want to initialize package manager ("yes" flag will be used)?',
      type: 'list',
      choices: [
        { name: 'Yarn', value: 'yarn' },
        { name: 'NPM', value: 'npm' },
        { name: 'Exit installation', value: 'exit' },
      ],
    });

    if (response.pm === 'exit') {
      return;
    }
    options?.successCb?.(`\nInitializing package manager "${response.pm}"`);

    await PackageManager.init(response.pm, {
      logCb: options?.logCb,
      warnCb: options?.warnCb,
    });
  }
  //Install SDK
  options?.successCb?.(`\nInstalling package "@superfaceai/one-sdk"`);
  await PackageManager.installPackage('@superfaceai/one-sdk', {
    logCb: options?.logCb,
    warnCb: options?.warnCb,
  });

  //Prompt user for dotenv installation
  if (
    await confirmPrompt(
      `Superface CLI would like to install dotenv package (https://github.com/motdotla/dotenv#readme).\nThis package is used to load superface secrets from .env file. You can use different one or install it manually later.\nWould you like to install it now?:`,
      { default: true }
    )
  ) {
    options?.successCb?.(`\nInstalling package "dotenv"`);
    await PackageManager.installPackage('dotenv', {
      logCb: options?.logCb,
      warnCb: options?.warnCb,
    });
  }

  //Prompt user for optional SDK token
  options?.successCb?.(`\nConfiguring package "@superfaceai/one-sdk"`);

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
      options?.successCb?.(
        `Your SDK token was saved to ${tokenEnvName} variable in .env file. You can use it for authentization during SDK usage by loading it to your enviroment.`
      );
    } else {
      options?.successCb?.('Continuing without SDK token');
    }
  }

  //Write .env file
  await OutputStream.writeOnce('.env', envContent);

  options?.successCb?.(`\n🆗 Superface have been configured successfully!`);

  //Lead to docs page
  options?.successCb?.(
    `\nNow you can follow our documentation to use installed capability: "${
      new URL(profileId, getStoreUrl()).href
    }"`
  );
}

async function selectRetryPolicy(
  provider: string,
  selectedUseCase: string
): Promise<RetryPolicy> {
  //Select retry policy
  const policyResponse: { policy: OnFail } = await inquirer.prompt({
    name: 'policy',
    message: `Select a failure policy for provider "${provider}" and use case: "${selectedUseCase}":`,
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
        `Do you want to customize circuit breaker parameters?:`,
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
    message: `Enter value of maximum contiguous retries for provider "${provider}" and use case: ${useCase}:`,
    type: 'number',
  });
  const requestTimeout: { requestTimeout: number } = await inquirer.prompt({
    name: 'requestTimeout',
    message: `Enter request timeout for provider "${provider}" and use case: ${useCase} (in miliseconds):`,
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
    message: `Enter initial value of exponential backoff for provider "${provider}" and use case: ${useCase} (in miliseconds):`,
    type: 'number',
  });
  const factor: { factor: number } = await inquirer.prompt({
    name: 'factor',
    message: `Enter value of exponent in exponential backoff for provider "${provider}" and use case: ${useCase} (in miliseconds):`,
    type: 'number',
  });

  return {
    kind: BackoffKind.EXPONENTIAL,
    factor: factor.factor,
    start: start.start,
  };
}

async function getPromptedValue(
  provider: string,
  authType: 'api key' | 'basic' | 'digest' | 'bearer',
  name: string,
  envVariableName: string,
  envContent: string,
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
  }
): Promise<string> {
  if (!envVariableName.startsWith('$')) {
    options?.warnCb?.(
      `Value of ${envVariableName} in "${provider}" "${authType}" security schema does not start with $ character.`
    );

    return envContent;
  }
  const variableName = envVariableName.substring(1);
  if (envContent.includes(`${variableName}=`)) {
    //Do we want to override?
    if (
      await confirmPrompt(
        `Value of "${variableName}" for "${provider}" is already set.\nDo you want to override it?:`
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
    message: `Enter ${name} of ${authType} security for "${provider}". This value will be stored locally in .env file:`,
    type: 'password',
  });

  return (envContent += envVariable(variableName, response.value));
}

async function resolveSecurityEnvValues(
  provider: string,
  schema: SecurityValues,
  envFile: string,
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
  }
): Promise<string> {
  let newEnvContent = envFile;
  if (isApiKeySecurityValues(schema)) {
    newEnvContent = await getPromptedValue(
      provider,
      'api key',
      'apikey',
      schema.apikey,
      newEnvContent,
      options
    );
  } else if (isBasicAuthSecurityValues(schema)) {
    newEnvContent = await getPromptedValue(
      provider,
      'basic',
      'username',
      schema.username,
      newEnvContent,
      options
    );
    newEnvContent = await getPromptedValue(
      provider,
      'basic',
      'password',
      schema.password,
      newEnvContent,
      options
    );
  } else if (isBearerTokenSecurityValues(schema)) {
    newEnvContent = await getPromptedValue(
      provider,
      'bearer',
      'token',
      schema.token,
      newEnvContent,
      options
    );
  } else if (isDigestSecurityValues(schema)) {
    newEnvContent = await getPromptedValue(
      provider,
      'bearer',
      'digest',
      schema.digest,
      newEnvContent,
      options
    );
  } else {
    options?.warnCb?.(`Unable to resolve security type for "${provider}"`);
  }

  return newEnvContent;
}

async function selectSecuritySchema(
  provider: string,
  schemas: SecurityValues[]
): Promise<SecurityValues> {
  const schemaResponse: { schema: SecurityValues } = await inquirer.prompt({
    name: 'schema',
    message: `Select a security schema for "${provider}":`,
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
