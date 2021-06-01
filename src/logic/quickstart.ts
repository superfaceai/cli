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
import inquirer from 'inquirer';
import { join as joinPath } from 'path';

import { fetchProfiles, fetchProviders } from '../common/http';
import { exists, readFile } from '../common/io';
import { LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { envVariable } from '../templates/env';
import { installProvider } from './configure';
import { initSuperface } from './init';
import { detectSuperJson, installProfiles } from './install';
import {
  getProviders,
  installSdk,
  profileExists,
  providerExists,
} from './quickstart.utils';

export async function interactiveInstall(options?: {
  logCb?: LogCallback;
  warnCb?: LogCallback;
  successCb?: LogCallback;
}): Promise<void> {
  let envContent = '';
  //Super.json path
  let superPath = await detectSuperJson(process.cwd());
  if (superPath) {
    //Overide existing super.json
    if (!(await confirmPrompt('Super.json already exists.'))) {
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
  const superJson = (
    await SuperJson.load(joinPath(superPath, META_FILE))
  ).unwrap();

  //Ask for profile
  const possibleProfiles = await fetchProfiles();
  const profileResponse: {
    profile: { scope: string; profile: string; version: string };
  } = await inquirer.prompt({
    name: 'profile',
    message: 'Select a capability to install',
    type: 'list',
    choices: possibleProfiles.map(p => {
      return { name: `${p.scope}/${p.profile}`, value: p };
    }),
  });
  const profile = profileResponse.profile;

  //Override existing profile
  if (await profileExists(superJson, profile)) {
    if (
      !(await confirmPrompt(
        `Profile "${profile.scope}/${profile.profile}" already exists.`
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
        profileId: `${profile.scope}/${profile.profile}`,
        version: profile.version,
      },
    ],
    {
      logCb: options?.logCb,
      warnCb: options?.warnCb,
      force: true,
    }
  );

  //Ask for providers
  const possibleProviders = await fetchProviders(
    `${profile.scope}/${profile.profile}@${profile.version}`
  );

  const providerResponse: { providers: string[] } = await inquirer.prompt({
    name: 'providers',
    message: 'Select the provider/s you want to use',
    type: 'checkbox',
    choices: possibleProviders.map(p => {
      return { name: p, checked: p === 'mock' };
    }),
    validate: (input: string[]): boolean => {
      return input.length > 0;
    },
  });

  //Configure providers
  options?.successCb?.(`\n\nInstalling providers`);
  const skippedProviders: string[] = [];
  for (const providerName of providerResponse.providers) {
    //Override existing provider
    if (providerExists(superJson, providerName)) {
      if (
        !(await confirmPrompt(`Provider "${providerName}" already exists.`))
      ) {
        skippedProviders.push(providerName);
        continue;
      }
    }
    //Install provider
    await installProvider(
      superPath,
      providerName,
      `${profile.scope}/${profile.profile}`,
      {
        logCb: options?.logCb,
        warnCb: options?.warnCb,
        force: true,
        local: false,
      }
    );
  }

  //Ask for provider security
  const installedProviders = await getProviders(superPath);

  options?.successCb?.(`\n\nConfiguring providers security`);

  //Get .env file
  if (await exists('.env')) {
    envContent = (await readFile('.env')).toString();
  }
  let selectedSchema: SecurityValues;
  for (const provider of Object.keys(installedProviders)) {
    //Do not change provider that user dont want to overide from instaledProviders array
    if (skippedProviders.includes(provider)) {
      continue;
    }
    options?.logCb?.(`\n\nConfiguring "${provider}" security`);
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
        `\n\nProvider "${provider}" can be used without authentication`
      );
    }
  }
  //Write .env file
  await OutputStream.writeOnce('.env', envContent);

  //Install SDK
  options?.successCb?.(`\n\nInstalling package "@superfaceai/one-sdk"`);
  await installSdk({ logCb: options?.logCb, warnCb: options?.warnCb });

  options?.successCb?.(`🆗 Superface have been configured successfully!`);

  //Lead to docs page

  //TODO: usecase specific page
  const url = 'https://docs.superface.ai/getting-started';
  options?.successCb?.(
    `Now you can follow our documentation to use installed capability: "${url}"`
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
        `Value of "${variableName}" for "${provider}" is already set.`
      )
    ) {
      //Delete set row
      envContent = envContent
        .split('\n')
        .filter(row => !row.includes(`${variableName}=`))
        .join('\n');
    } else {
      options?.warnCb?.(
        `Value of "${variableName}" for "${provider}" is already set`
      );

      return envContent;
    }
  }

  const response: { value: string } = await inquirer.prompt({
    name: 'value',
    message: `Enter ${name} of ${authType} security for "${provider}" This value will be stored locally in .env file.`,
    type: 'input',
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
    message: `Select a security schema for "${provider}"`,
    type: 'list',
    choices: schemas.map(s => {
      return { name: s.id, value: s };
    }),
  });

  return schemaResponse.schema;
}

async function confirmPrompt(message?: string): Promise<boolean> {
  const prompt: { continue: boolean } = await inquirer.prompt({
    name: 'continue',
    message: message
      ? `${message} Do you want to override it?`
      : 'Do you want to continue with installation?',
    type: 'confirm',
    default: false,
  });

  return prompt.continue;
}
