import { isValidDocumentName, isValidVersionString } from '@superfaceai/ast';
import {
  isApiKeySecurityValues,
  isBasicAuthSecurityValues,
  isBearerTokenSecurityValues,
  isDigestSecurityValues,
  META_FILE,
  SecurityValues,
  SUPERFACE_DIR,
  SuperJson,
} from '@superfaceai/one-sdk';
import { bold } from 'chalk';
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { fetchProviders } from '../common/http';
import { exists, readFile } from '../common/io';
import { LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { PackageManager } from '../common/package-manager';
import { envVariable } from '../templates/env';
import { installProvider } from './configure';
import { initSuperface } from './init';
import { detectSuperJson, installProfiles } from './install';
import { profileExists, providerExists } from './quickstart.utils';

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
  if (superPath) {
    //Overide existing super.json
    if (
      !(await confirmPrompt(
        'Configuration file super.json already exists.\nDo you want to override it?:'
      ))
    ) {
      options?.warnCb?.(`Super.json already exists at path "${superPath}"`);

      return;
    }
  }

  //Init SF
  options?.successCb?.('Initializing superface directory');
  await initSuperface(
    './',
    { profiles: {}, providers: {} },
    { logCb: options?.logCb }
  );
  superPath = SUPERFACE_DIR;

  //Load super.json (for checks)
  let superJson = (
    await SuperJson.load(joinPath(superPath, META_FILE))
  ).unwrap();

  options?.successCb?.(`\nInitializing ${profileArg}`);

  //Override existing profile
  if (await profileExists(superJson, { profile, scope, version })) {
    if (
      !(await confirmPrompt(
        `Profile "${scope}/${profile}" already exists.\nDo you want to override it?:`
      ))
    )
      return;
  }

  //Install profile
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
        p => !providersWithPriority.find(pwp => pwp.name === p) && p !== 'mock'
      )
      .map(p => {
        return { name: p, value: { name: p, priority, exit: false } };
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
    if (providerResponse.provider.exit || choices.length === 2) {
      exit = true;
    } else {
      providersWithPriority.push({
        name: providerResponse.provider.name,
        priority: providerResponse.provider.priority,
      });
      priority++;
    }
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

  //Install providers
  for (const provider of providersToInstall) {
    //Install provider
    await installProvider(superPath, provider, profileId, {
      logCb: options?.logCb,
      warnCb: options?.warnCb,
      force: true,
      local: false,
    });
  }

  //Ask for provider security
  //Reload super.json
  superJson = (await SuperJson.load(joinPath(superPath, META_FILE))).unwrap();
  //Get installed
  const installedProviders = superJson.normalized.providers;

  //Set priority
  superJson.addPriority(profileId, providersToInstall);
  // write new information to super.json
  await OutputStream.writeOnce(superJson.path, superJson.stringified);

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
  //TODO: usecase specific page
  const url = 'https://docs.superface.ai/getting-started';
  options?.successCb?.(
    `\nNow you can follow our documentation to use installed capability: "${url}"`
  );
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
