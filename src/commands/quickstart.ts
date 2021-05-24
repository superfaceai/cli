import { flags } from '@oclif/command';
import {
  isApiKeySecurityValues,
  isBasicAuthSecurityValues,
  isBearerTokenSecurityValues,
  isDigestSecurityValues,
  SecurityValues,
} from '@superfaceai/one-sdk';
import { grey, yellow } from 'chalk';
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
    this.logCallback?.('Initializing superface directory');
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
      message: 'Select a profile to install',
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
        return { name: p };
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
    this.logCallback?.(`\n\nInstalling providers`);
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
    const installedProviders = await getProviders(superPath, {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
    });

    this.logCallback?.(`\n\nConfiguring providers security`);

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
        this.logCallback?.(
          `\n\nProvider "${provider}" can be used without authentication`
        );
      }
    }

    //Install SDK
    this.logCallback?.(`\n\nInstalling package "@superfaceai/one-sdk"`);
    await installSdk({ logCb: this.logCallback, warnCb: this.warnCallback });

    this.logCallback?.(`🆗 Superface have been configured successfully!`);

    //Lead to docs page

    //TODO: usecase specific page
    const url = 'https://docs.superface.ai/getting-started';
    this.logCallback?.(
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
  ): Promise<string | undefined> {
    const response: { value: string } = await inquirer.prompt({
      name: 'value',
      message: `Enter ${name} of ${authType} security for "${provider}" This value will be stored locally in .env file.`,
      type: 'input',
    });
    if (process.env[envVariableName]) {
      options?.warnCb?.(
        `Value of "${envVariableName}" for "${provider}" is already set`
      );

      return;
    } else {
      return envVariable(envVariableName, response.value);
    }
  }

  private async setSecurityEnvValues(
    provider: string,
    schema: SecurityValues,
    options?: {
      logCb?: LogCallback;
      warnCb?: LogCallback;
    }
  ): Promise<void> {
    //Get .env file
    //TODO: path resolution and err handling
    let envContent = '';
    if (await exists('.env')) {
      envContent = (await readFile('.env')).toString();
    }

    if (isApiKeySecurityValues(schema)) {
      envContent += await this.setPromptedValue(
        provider,
        'api key',
        'apikey',
        schema.apikey,
        options
      );
    } else if (isBasicAuthSecurityValues(schema)) {
      envContent += await this.setPromptedValue(
        provider,
        'basic',
        'username',
        schema.username,
        options
      );
      envContent += await this.setPromptedValue(
        provider,
        'basic',
        'password',
        schema.password,
        options
      );
    } else if (isBearerTokenSecurityValues(schema)) {
      envContent += await this.setPromptedValue(
        provider,
        'bearer',
        'token',
        schema.token,
        options
      );
    } else if (isDigestSecurityValues(schema)) {
      envContent += await this.setPromptedValue(
        provider,
        'bearer',
        'digest',
        schema.digest,
        options
      );
    } else {
      options?.warnCb?.(`Unable to resolve security type for "${provider}"`);
    }

    await OutputStream.writeIfAbsent('.env', envContent);
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
