import { flags } from '@oclif/command';
import {
  isApiKeySecurityValues,
  isBasicAuthSecurityValues,
  isBearerTokenSecurityValues,
  isDigestSecurityValues,
  SecurityValues,
} from '@superfaceai/one-sdk';
import { green, grey, yellow } from 'chalk';
import inquirer from 'inquirer';

import { Command } from '../common/command.abstract';
import { SUPERFACE_DIR } from '../common/document';
import { fetchProfiles, fetchProviders } from '../common/http';
import { exists, readFile } from '../common/io';
import { LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import { detectSuperJson, installProfiles } from '../logic/install';
import { getProviders, installSdk } from '../logic/quickstart';
import { envVariable } from '../templates/env';

export default class Quickstart extends Command {
  static description =
    'Automatically initializes superface directory in current working directory if needed, communicates with Superface Store API, stores profiles and compiled files to a local system. Install without any arguments tries to install profiles and providers listed in super.json';

  static args = [
    {
      name: 'profileId',
      required: false,
      description:
        'Profile identifier consisting of scope (optional), profile name and its version.',
      default: undefined,
    },
  ];

  static flags = {
    ...Command.flags,
    help: flags.help({ char: 'h' }),
  };

  static examples = ['$ superface quickstart', '$ superface quickstart -q'];

  private warnCallback? = (message: string) =>
    this.log('⚠️  ' + yellow(message));

  private logCallback? = (message: string) => this.log(grey(message));
  private successCallback? = (message: string) => this.log(green(message));

  private envContent = '';

  async run(): Promise<void> {
    const { flags } = this.parse(Quickstart);

    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;
    }

    //Super.json path
    let superPath = await detectSuperJson(process.cwd());
    if (superPath) {
      this.warnCallback?.(`Super.json already exists at path "${superPath}"`);
    }

    //Init SF
    this.successCallback?.('Initializing superface directory');
    await initSuperface(
      './',
      { profiles: {}, providers: {} },
      { logCb: this.logCallback }
    );
    superPath = SUPERFACE_DIR;

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

    //Ask for providers
    const possibleProviders = await fetchProviders(
      `${profile.scope}/${profile.profile}@${profile.version}`
    );

    const providerResponse: { providers: string[] } = await inquirer.prompt({
      name: 'providers',
      message: 'Select a provider to execute',
      type: 'checkbox',
      choices: possibleProviders.map(p => {
        return { name: p, checked: p === 'mock' };
      }),
      validate: (input: string[]): boolean => {
        return input.length > 0;
      },
    });

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
        logCb: this.logCallback,
        warnCb: this.warnCallback,
        force: false,
      }
    );

    //Configure providers
    this.successCallback?.(`\n\nInstalling providers`);
    for (const providerName of providerResponse.providers) {
      //Install provider
      await installProvider(
        superPath,
        providerName,
        `${profile.scope}/${profile.profile}`,
        {
          logCb: this.logCallback,
          warnCb: this.warnCallback,
          force: false,
          local: false,
        }
      );
    }

    //Ask for provider security
    const installedProviders = await getProviders(superPath);

    this.successCallback?.(`\n\nConfiguring providers security`);

    //Get .env file
    if (await exists('.env')) {
      this.envContent = (await readFile('.env')).toString();
    }
    let selectedSchema: SecurityValues;
    for (const provider of Object.keys(installedProviders)) {
      this.logCallback?.(`\n\nConfiguring "${provider}" security`);
      //Select security schema
      if (
        installedProviders[provider].security &&
        installedProviders[provider].security.length > 0
      ) {
        if (installedProviders[provider].security.length === 1) {
          selectedSchema = installedProviders[provider].security[0];
        } else {
          selectedSchema = await this.selectSecuritySchema(
            provider,
            installedProviders[provider].security
          );
        }

        //Set env variables for selected schema
        await this.setSecurityEnvValues(provider, selectedSchema, {
          logCb: this.logCallback,
          warnCb: this.warnCallback,
        });
      } else {
        this.successCallback?.(
          `\n\nProvider "${provider}" can be used without authentication`
        );
      }
    }
    //Write .env file
    await OutputStream.writeOnce('.env', this.envContent);

    //Install SDK
    this.successCallback?.(`\n\nInstalling package "@superfaceai/one-sdk"`);
    await installSdk({ logCb: this.logCallback, warnCb: this.warnCallback });

    this.successCallback?.(`🆗 Superface have been configured successfully!`);

    //Lead to docs page

    //TODO: usecase specific page
    const url = 'https://docs.superface.ai/getting-started';
    this.successCallback?.(
      `Now you can follow our documentation to use installed capability: "${url}"`
    );
  }

  private async setPromptedValue(
    provider: string,
    authType: 'api key' | 'basic' | 'digest' | 'bearer',
    name: string,
    envVariableName: string,
    options?: {
      logCb?: LogCallback;
      warnCb?: LogCallback;
    }
  ): Promise<void> {
    if (!envVariableName.startsWith('$')) {
      options?.warnCb?.(
        `Value of ${envVariableName} in "${provider}" "${authType}" security schema does not start with $ character.`
      );

      return;
    }
    const variableName = envVariableName.substring(1);
    if (this.envContent.includes(`${variableName}=`)) {
      options?.warnCb?.(
        `Value of "${variableName}" for "${provider}" is already set`
      );

      return;
    }

    const response: { value: string } = await inquirer.prompt({
      name: 'value',
      message: `Enter ${name} of ${authType} security for "${provider}" This value will be stored locally in .env file.`,
      type: 'input',
    });

    this.envContent += envVariable(variableName, response.value);
  }

  private async setSecurityEnvValues(
    provider: string,
    schema: SecurityValues,
    options?: {
      logCb?: LogCallback;
      warnCb?: LogCallback;
    }
  ): Promise<void> {
    if (isApiKeySecurityValues(schema)) {
      await this.setPromptedValue(
        provider,
        'api key',
        'apikey',
        schema.apikey,
        options
      );
    } else if (isBasicAuthSecurityValues(schema)) {
      await this.setPromptedValue(
        provider,
        'basic',
        'username',
        schema.username,
        options
      );
      await this.setPromptedValue(
        provider,
        'basic',
        'password',
        schema.password,
        options
      );
    } else if (isBearerTokenSecurityValues(schema)) {
      await this.setPromptedValue(
        provider,
        'bearer',
        'token',
        schema.token,
        options
      );
    } else if (isDigestSecurityValues(schema)) {
      await this.setPromptedValue(
        provider,
        'bearer',
        'digest',
        schema.digest,
        options
      );
    } else {
      options?.warnCb?.(`Unable to resolve security type for "${provider}"`);
    }
  }

  private async selectSecuritySchema(
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
}
