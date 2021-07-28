import { flags as oclifFlags } from '@oclif/command';
import { isValidIdentifier } from '@superfaceai/ast';
import { parseDocumentId } from '@superfaceai/parser';
import { grey, yellow } from 'chalk';
import inquirer from 'inquirer';

import { composeUsecaseName, DEFAULT_PROFILE_VERSION_STR } from '../../common';
import { Command } from '../../common/command.abstract';
import { developerError, userError } from '../../common/error';
import { mkdirQuiet } from '../../common/io';
import { create } from '../../logic/create';

export default class Create extends Command {
  static strict = false;

  static description =
    'Creates empty map, profile or/and provider on a local filesystem.';

  static args = [
    {
      name: 'documentName',
      required: false,
      description: 'Document Name - name of a file that will be created',
    },
  ];

  static flags = {
    ...Command.flags,
    profile: oclifFlags.string({
      char: 'm',
      description: 'Name of a profile',
    }),
    map: oclifFlags.string({
      char: 'm',
      description: 'Name of a provider that map maps to a profile',
    }),
    interactive: oclifFlags.boolean({
      char: 'i',
      description: `When set to true, command is used in interactive mode.`,
      default: false,
      exclusive: ['quiet', 'profile', 'map'],
    }),
    usecase: oclifFlags.string({
      char: 'u',
      multiple: true,
      description: 'Usecases that profile or map contains',
    }),
    provider: oclifFlags.string({
      char: 'p',
      description: 'Name of a provider',
    }),
    variant: oclifFlags.string({
      char: 't',
      description: 'Variant of a map',
      dependsOn: ['provider'],
    }),
    version: oclifFlags.string({
      char: 'v',
      default: DEFAULT_PROFILE_VERSION_STR,
      description: 'Version of a profile',
    }),
    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
  };

  static examples = [
    //Interactive
    '$ superface create sms/service -i',
    '$ superface create sms/service -u SendSMS ReceiveSMS -i',
    '$ superface create sms/service -p twilio -i',
    '$ superface create sms/service -p twilio -u SendSMS ReceiveSMS -i',
    '$ superface create sms/service -p twilio -u SendSMS ReceiveSMS -i',
    '$ superface create sms/service -p twilio -t bugfix -v 1.1-rev133 -u SendSMS ReceiveSMS -i',
  ];

  private warnCallback? = (message: string) => this.log(yellow(message));
  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { argv, flags } = this.parse(Create);

    if (argv.length > 2) {
      throw userError('Invalid command!', 1);
    }

    const documentName = argv[0];

    if (documentName === 'profile' || documentName === 'map') {
      throw userError('Name of your document is reserved!', 1);
    }

    //Interactive
    if (flags.interactive) {
      if (!documentName) {
        this.warnCallback?.(
          `Document name argument must be used with interactive flag`
        );
        this.exit(0);
      }

      await this.interactiveCreate(documentName, flags);

      return;
    }

    //Manual
    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;
    }

    const createProfile = await this.createPrompt(
      'You you want to create profile?'
    );
    const createMap = await this.createPrompt('You you want to create map?');
    const createProvider = await this.createPrompt(
      'You you want to create provider?'
    );

    // output a warning when generating profile only and provider is specified
    if (createProfile && !createMap && !createProvider && flags.provider) {
      this.warn(
        'Provider should not be specified when generating profile only'
      );
      flags.provider = undefined;

      // output a warning when variant is specified as well
      if (flags.variant) {
        this.warn(
          'Variant should not be specified when generating profile only'
        );
        flags.variant = undefined;
      }
    }

    // output a warning when generating map only and version is not in default format
    if (
      !createProfile &&
      createMap &&
      !createProvider &&
      flags.version !== DEFAULT_PROFILE_VERSION_STR
    ) {
      this.warn(
        'Profile version should not be specified when generating map only'
      );
      flags.version = DEFAULT_PROFILE_VERSION_STR;
    }

    // parse document name and flags
    const providerName = flags.provider ? `.${flags.provider}` : '';
    const variant = flags.variant ? `.${flags.variant}` : '';
    const documentId = `${documentName}${providerName}${variant}@${flags.version}`;
    const documentResult = parseDocumentId(documentId);

    if (documentResult.kind === 'error') {
      throw userError(documentResult.message, 1);
    }

    // compose document structure from the result
    const documentStructure = documentResult.value;
    const {
      scope,
      version,
      middle: [name],
    } = documentStructure;

    if (version === undefined) {
      throw developerError('version must be present', 1);
    }

    // if there is no specified usecase - create usecase with same name as profile name
    const usecases = flags.usecase ?? [composeUsecaseName(name)];
    for (const usecase of usecases) {
      if (!isValidIdentifier(usecase)) {
        throw userError(`Invalid usecase name: ${usecase}`, 1);
      }
    }

    // create scope directory if it already doesn't exist
    if (scope) {
      await mkdirQuiet(scope);
    }

    const superPath = await this.getSuperPath(flags.scan, {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
    });

    await create(
      superPath,
      { createProvider, createMap, createProfile },
      usecases,
      {
        scope,
        version,
        middle: documentStructure.middle,
      },
      {
        logCb: this.logCallback,
        warnCb: this.warnCallback,
      }
    );
  }

  async interactiveCreate(
    documentName: string,
    flags: {
      usecase: string[];
      provider: string | undefined;
      variant: string | undefined;
      version: string;
      scan: number | undefined;
      quiet: boolean;
      help: void;
    }
  ): Promise<void> {
    const createProfile = await this.createPrompt(
      'Do you want to create a profile?'
    );
    const createMap = await this.createPrompt('You you want to create map?');
    const createProvider = await this.createPrompt(
      'You you want to create provider?'
    );

    // output a warning when generating profile only and provider is specified
    if (createProfile && !createMap && !createProvider && flags.provider) {
      this.warn(
        'Provider should not be specified when generating profile only'
      );
      flags.provider = undefined;

      // output a warning when variant is specified as well
      if (flags.variant) {
        this.warn(
          'Variant should not be specified when generating profile only'
        );
        flags.variant = undefined;
      }
    }

    // output a warning when generating map only and version is not in default format
    if (
      !createProfile &&
      createMap &&
      !createProvider &&
      flags.version !== DEFAULT_PROFILE_VERSION_STR
    ) {
      this.warn(
        'Profile version should not be specified when generating map only'
      );
      flags.version = DEFAULT_PROFILE_VERSION_STR;
    }

    // parse document name and flags
    const providerName = flags.provider ? `.${flags.provider}` : '';
    const variant = flags.variant ? `.${flags.variant}` : '';
    const documentId = `${documentName}${providerName}${variant}@${flags.version}`;
    const documentResult = parseDocumentId(documentId);

    if (documentResult.kind === 'error') {
      throw userError(documentResult.message, 1);
    }

    // compose document structure from the result
    const documentStructure = documentResult.value;
    const {
      scope,
      version,
      middle: [name],
    } = documentStructure;

    if (version === undefined) {
      throw developerError('version must be present', 1);
    }

    // if there is no specified usecase - create usecase with same name as profile name
    const usecases = flags.usecase ?? [composeUsecaseName(name)];
    for (const usecase of usecases) {
      if (!isValidIdentifier(usecase)) {
        throw userError(`Invalid usecase name: ${usecase}`, 1);
      }
    }

    // create scope directory if it already doesn't exist
    if (scope) {
      await mkdirQuiet(scope);
    }

    const superPath = await this.getSuperPath(flags.scan, {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
    });

    await create(
      superPath,
      { createProvider, createMap, createProfile },
      usecases,
      {
        scope,
        version,
        middle: documentStructure.middle,
      },
      {
        logCb: this.logCallback,
        warnCb: this.warnCallback,
      }
    );
  }

  async createPrompt(message: string): Promise<boolean> {
    const prompt: { create: boolean } = await inquirer.prompt({
      name: 'create',
      message,
      type: 'confirm',
      default: true,
    });

    return prompt.create;
  }
}
