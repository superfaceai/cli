import { flags as oclifFlags } from '@oclif/command';
import { isValidIdentifier } from '@superfaceai/ast';
import {
  DocumentVersion,
  isValidDocumentIdentifier,
  parseProfileId,
} from '@superfaceai/parser';
import { grey, yellow } from 'chalk';
import inquirer from 'inquirer';

import {
  composeUsecaseName,
  DEFAULT_PROFILE_VERSION,
  DEFAULT_PROFILE_VERSION_STR,
} from '../common';
import { Command } from '../common/command.abstract';
import { developerError, userError } from '../common/error';
import { mkdirQuiet } from '../common/io';
import { create } from '../logic/create';

export default class Create extends Command {
  static strict = false;

  static description =
    'Creates empty map, profile or/and provider on a local filesystem.';

  static flags = {
    ...Command.flags,
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope](optional)/[name]',
    }),
    providerName: oclifFlags.string({
      multiple: true,
      description:
        'Names of provider. This argument is used to create maps and/or providers',
    }),
    profile: oclifFlags.boolean({
      description: 'Create a profile',
      dependsOn: ['profileId'],
    }),
    map: oclifFlags.boolean({
      description: 'Create a map',
      dependsOn: ['profileId', 'providerName'],
    }),
    provider: oclifFlags.boolean({
      description: 'Create a provider',
      dependsOn: ['providerName'],
    }),
    interactive: oclifFlags.boolean({
      char: 'i',
      description: `When set to true, command is used in interactive mode.`,
      default: false,
      exclusive: ['quiet', 'profile', 'map', 'provider'],
    }),
    usecase: oclifFlags.string({
      char: 'u',
      multiple: true,
      description: 'Usecases that profile or map contains',
      dependsOn: ['profileId'],
    }),
    variant: oclifFlags.string({
      char: 't',
      description: 'Variant of a map',
      dependsOn: ['profileId', 'providerName'],
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
    //Manual
    //Profile only
    '$ superface create --profileId sms/service --profile',
    '$ superface create --profileId sms/service --profile -u SendSMS ReceiveSMS',
    '$ superface create --profileId sms/service --profile -v 1.1-rev133 -u SendSMS ReceiveSMS',
    //Map only
    '$ superface create --profileId sms/service --providerName twilio --map',
    '$ superface create --profileId sms/service --providerName twilio tyntec --map -u SendSMS ReceiveSMS',
    '$ superface create --profileId sms/service --providerName twilio --map -t bugfix -u SendSMS ReceiveSMS',
    //Provider only
    '$ superface create --providerName twillio --provider',
    '$ superface create --providerName twillio tyntec --provider',
    //Profile and provider
    '$ superface create --profileId sms/service --providerName twilio --profile --provider',
    '$ superface create --profileId sms/service --providerName twilio tyntec --profile --provider -u SendSMS ReceiveSMS',
    '$ superface create --profileId sms/service --providerName twilio --profile --provider -v 1.1-rev133 -u SendSMS ReceiveSMS',
    //Profile and map
    '$ superface create --profileId sms/service --providerName twilio --map --profile -u SendSMS ReceiveSMS',
    '$ superface create --profileId sms/service --providerName twilio --map --profile -t bugfix -v 1.1-rev133 -u SendSMS ReceiveSMS',
    //Profile, map and provider
    '$ superface create --profileId sms/service --providerName twilio --provider --map --profile -u SendSMS ReceiveSMS',
    '$ superface create --profileId sms/service --providerName twilio --provider --map --profile -t bugfix -v 1.1-rev133 -u SendSMS ReceiveSMS',
    //Interactive
    '$ superface create --profileId sms/service -i',
    '$ superface create --profileId sms/service -u SendSMS ReceiveSMS -i',
    '$ superface create --profileId sms/service --providerName twilio -i',
    '$ superface create --profileId sms/service --providerName twilio -u SendSMS ReceiveSMS -i',
    '$ superface create --profileId sms/service --providerName twilio -t bugfix -v 1.1-rev133 -u SendSMS ReceiveSMS -i',
  ];

  private warnCallback? = (message: string) => this.log(yellow(message));
  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { flags } = this.parse(Create);

    if (!flags.profileId && !flags.providerName) {
      throw userError('Invalid command! Specify profileId or providerName', 1);
    }
    //Interactive
    if (flags.interactive) {
      flags.profile = await this.createPrompt(
        'Do you want to create a profile?'
      );
      flags.map = await this.createPrompt('Do you want to create a map?');
      flags.provider = await this.createPrompt(
        'Do you want to create a provider?'
      );
    }

    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;
    }
    let profileId: string | undefined = undefined;
    let providerNames: string[] = [];

    //Check inputs
    if (flags.profileId) {
      if (flags.profileId === 'profile' || flags.profileId === 'map') {
        throw userError('ProfileId is reserved!', 1);
      }
      profileId = flags.profileId;
    }
    if (flags.providerName) {
      for (const provider of flags.providerName) {
        if (provider === 'profile' || provider === 'map') {
          throw userError(`ProviderName "${provider}" is reserved!`, 1);
        }
        if (!isValidDocumentIdentifier(provider)) {
          throw userError(`Invalid provider name: ${provider}`, 1);
        }
      }
    }
    providerNames = flags.providerName;

    // output a warning when generating profile only and provider is specified
    if (flags.profile && !flags.map && !flags.provider && flags.providerName) {
      this.warn(
        'Provider should not be specified when generating profile only'
      );
      providerNames = [];

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
      !flags.profile &&
      flags.map &&
      !flags.provider &&
      flags.version !== DEFAULT_PROFILE_VERSION_STR
    ) {
      this.warn(
        'Profile version should not be specified when generating map only'
      );
      flags.version = DEFAULT_PROFILE_VERSION_STR;
    }

    let scope,
      name: string | undefined = undefined;
    let version: DocumentVersion | undefined = DEFAULT_PROFILE_VERSION;
    let usecases: string[] = [];
    if (profileId) {
      // parse profile Id
      const parsedProfileId = parseProfileId(`${profileId}@${flags.version}`);
      if (parsedProfileId.kind === 'error') {
        throw userError(parsedProfileId.message, 1);
      }

      // compose document structure from the result
      scope = parsedProfileId.value.scope;
      version = parsedProfileId.value.version;
      name = parsedProfileId.value.name;

      // parse variant
      if (flags.variant && !isValidDocumentIdentifier(flags.variant)) {
        throw userError(`Invalid map variant: ${flags.variant}`, 1);
      }

      //just a sane check
      if (version === undefined) {
        throw developerError('Version must be present', 1);
      }

      // if there is no specified usecase - create usecase with same name as profile name
      usecases = flags.usecase ?? [composeUsecaseName(name)];
      for (const usecase of usecases) {
        if (!isValidIdentifier(usecase)) {
          throw userError(`Invalid usecase name: ${usecase}`, 1);
        }
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
      {
        createProvider: !!flags.provider,
        createMap: !!flags.map,
        createProfile: !!flags.profile,
      },
      usecases,
      {
        scope,
        version,
        providerNames,
        name,
        variant: flags.variant,
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
