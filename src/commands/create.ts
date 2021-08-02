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
  SUPERFACE_DIR,
} from '../common';
import { Command } from '../common/command.abstract';
import { developerError, userError } from '../common/error';
import { exists, mkdirQuiet } from '../common/io';
import { NORMALIZED_CWD_PATH } from '../common/path';
import { create } from '../logic/create';
import { initSuperface } from '../logic/init';
import { detectSuperJson } from '../logic/install';

export default class Create extends Command {
  static strict = false;

  static description =
    'Creates empty map, profile or/and provider on a local filesystem.';

  static flags = {
    ...Command.flags,
    //Inputs
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope](optional)/[name]',
    }),
    providerName: oclifFlags.string({
      multiple: true,
      description:
        'Names of providers. This argument is used to create maps and/or providers',
    }),
    //What do we create
    profile: oclifFlags.boolean({
      description: 'Create a profile',
    }),
    map: oclifFlags.boolean({
      description: 'Create a map',
    }),
    provider: oclifFlags.boolean({
      description: 'Create a provider',
    }),
    usecase: oclifFlags.string({
      char: 'u',
      multiple: true,
      description: 'Usecases that profile or map contains',
    }),
    variant: oclifFlags.string({
      char: 't',
      description: 'Variant of a map',
    }),
    version: oclifFlags.string({
      char: 'v',
      default: DEFAULT_PROFILE_VERSION_STR,
      description: 'Version of a profile',
    }),
    //Command modifiers
    init: oclifFlags.boolean({
      default: false,
      description: `When set to true, command will initialize Superface`,
      exclusive: ['no-init'],
    }),
    ['no-init']: oclifFlags.boolean({
      default: false,
      description: `When set to true, command won't initialize Superface`,
      exclusive: ['init'],
    }),
    ['no-super-json']: oclifFlags.boolean({
      default: false,
      description: `When set to true, command won't change SuperJson file`,
    }),
    interactive: oclifFlags.boolean({
      char: 'i',
      description: `When set to true, command is used in interactive mode.`,
      default: false,
      exclusive: ['quiet', 'profile', 'map', 'provider'],
    }),
    path: oclifFlags.string({
      char: 'p',
      default: undefined,
      description: 'Base path where files will be created',
    }),
    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
  };

  static examples = [
    '$ superface create --profileId sms/service --profile',
    '$ superface create --profileId sms/service --profile -v 1.1-rev133 -u SendSMS ReceiveSMS',
    '$ superface create --profileId sms/service --providerName twilio --map',
    '$ superface create --profileId sms/service --providerName twilio --map -t bugfix',
    '$ superface create --providerName twilio tyntec --provider',
    '$ superface create --profileId sms/service --providerName twilio --provider --map --profile -t bugfix -v 1.1-rev133 -u SendSMS ReceiveSMS',
    '$ superface create -i',
  ];

  private warnCallback?= (message: string) => this.log(yellow(message));
  private logCallback?= (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { flags } = this.parse(Create);

    if (!flags.profileId && !flags.providerName && !flags.interactive) {
      throw userError('Invalid command! Specify profileId or providerName', 1);
    }
    if (flags.path && !(await exists(flags.path))) {
      throw userError(
        `Invalid command! Path "${flags.path}" does not exist`,
        1
      );
    }

    //Not creating anything
    if (!flags.provider && !flags.profile && !flags.map && !flags.interactive) {
      this.warn(
        'Create command without flag --profile or --provider or --map or --interactive does not do anything'
      );

      return;
    }

    //Interactive
    if (flags.interactive) {
      flags.profile = await this.confirmPrompt(
        'Do you want to create a profile?'
      );
      flags.map = await this.confirmPrompt('Do you want to create a map?');
      flags.provider = await this.confirmPrompt(
        'Do you want to create a provider?'
      );
      //We need profile Id
      if (!flags.profileId && (flags.profile || flags.map)) {
        let profileInput: string | undefined = undefined;
        profileInput = await this.inputPrompt(
          'Enter profile Id in format [scope](optional)/[name]'
        );
        if (!profileInput) {
          throw userError('Invalid command! Profile Id must be defined', 1);
        }
        flags.profileId = profileInput;
      }
      //We need provider name
      if (!flags.providerName && (flags.provider || flags.map)) {
        flags.providerName = [];
        let priority = 1;
        let exit = false;
        let providerInput: string | undefined = undefined;
        const priorityToString: Map<number, string> = new Map([
          [1, 'primary'],
          [2, 'secondary'],
          [3, 'third'],
          [4, 'fourth'],
          [5, 'fifth'],
        ]);
        while (!exit) {
          providerInput = await this.inputPrompt(
            `Enter provider name of ${priorityToString.get(priority) || priority
            } provider.\nExit loop by pressing enter without any input.`
          );
          if (!providerInput) {
            //We don't have any name
            if (priority === 1) {
              throw userError(
                'Invalid command! At least one provider must be defined',
                1
              );
            }
            exit = true;
            continue;
          }
          flags.providerName.push(providerInput);
          priority++;
        }
      }
    }

    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;
    }
    let profileId: string | undefined = undefined;
    let providerNames: string[] = [];

    //Check inputs
    if (flags.profile && !flags.profileId) {
      throw userError('--profileId= must be provided when creating profile', 1);
    }
    if (flags.map && !flags.profileId) {
      throw userError('--profileId= must be provided when creating map', 1);
    }
    if (flags.map && !flags.providerName) {
      throw userError('--providerName= must be provided when creating map', 1);
    }
    if (flags.providerName && !flags.providerName) {
      throw userError(
        '--providerName= must be provided when creating provider',
        1
      );
    }
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

    let initSf = false;
    let superPath: string | undefined = await detectSuperJson(
      process.cwd(),
      flags.scan
    );
    //We do want to init
    if (flags.init) {
      if (superPath) {
        this.warnCallback?.('Superface has been already initialized');
      } else {
        initSf = true;
      }
    }
    //We prompt user
    if (!flags['no-init'] && !flags.init && !superPath) {
      this.warnCallback?.("File 'super.json' has not been found.");

      const response: { init: boolean } = await inquirer.prompt({
        name: 'init',
        message: 'Would you like to initialize new superface structure?',
        type: 'confirm',
      });

      initSf = response.init;
    }

    //Init SF
    if (initSf) {
      this.logCallback?.(
        "Initializing superface directory with empty 'super.json'"
      );
      await initSuperface(
        NORMALIZED_CWD_PATH,
        { profiles: {}, providers: {} },
        { logCb: this.logCallback }
      );
      superPath = SUPERFACE_DIR;
    }

    //Do not change superJson
    if (flags['no-super-json']) {
      superPath = undefined;
    }

    await create(
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
      superPath,
      flags.path,
      {
        logCb: this.logCallback,
        warnCb: this.warnCallback,
      }
    );
  }

  async inputPrompt(message: string): Promise<string | undefined> {
    const prompt: { input: string | undefined } = await inquirer.prompt({
      name: 'input',
      message,
      type: 'input',
      default: undefined,
    });

    return prompt.input;
  }

  async confirmPrompt(message: string): Promise<boolean> {
    const prompt: { create: boolean } = await inquirer.prompt({
      name: 'create',
      message,
      type: 'confirm',
      default: true,
    });

    return prompt.create;
  }
}
