import { flags as oclifFlags } from '@oclif/command';
import {
  isValidDocumentName,
  isValidIdentifier,
  isValidProviderName,
} from '@superfaceai/ast';
import { parseProfileId, VersionRange } from '@superfaceai/parser';
import inquirer from 'inquirer';

import { Command, Flags } from '../common/command.abstract';
import {
  composeUsecaseName,
  DEFAULT_PROFILE_VERSION,
  DEFAULT_PROFILE_VERSION_STR,
  SUPERFACE_DIR,
  UNVERIFIED_PROVIDER_PREFIX,
} from '../common/document';
import { developerError, userError } from '../common/error';
import { exists, mkdirQuiet } from '../common/io';
import { ILogger } from '../common/log';
import { NORMALIZED_CWD_PATH } from '../common/path';
import { create } from '../logic/create';
import { initSuperface } from '../logic/init';
import { detectSuperJson } from '../logic/install';

export default class Create extends Command {
  static strict = true;

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
      description: 'When set to true, command will initialize Superface',
      exclusive: ['no-init'],
    }),
    ['no-init']: oclifFlags.boolean({
      default: false,
      description: "When set to true, command won't initialize Superface",
      exclusive: ['init'],
    }),
    ['no-super-json']: oclifFlags.boolean({
      default: false,
      description: "When set to true, command won't change SuperJson file",
    }),
    interactive: oclifFlags.boolean({
      char: 'i',
      description: 'When set to true, command is used in interactive mode.',
      default: false,
      exclusive: ['quiet', 'profile', 'map', 'provider'],
    }),
    path: oclifFlags.string({
      char: 'p',
      default: undefined,
      description: 'Base path where files will be created',
    }),
    mapFileName: oclifFlags.string({
      default: undefined,
      description: 'Name of map file',
    }),
    profileFileName: oclifFlags.string({
      default: undefined,
      description: 'Name of profile file',
    }),
    providerFileName: oclifFlags.string({
      default: undefined,
      description: 'Name of provider file',
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
    '$ superface create --providerName twilio --provider --providerFileName my-provider -p my/path',
    '$ superface create --profileId sms/service --providerName twilio --provider --map --profile -t bugfix -v 1.1-rev133 -u SendSMS ReceiveSMS',
    '$ superface create -i',
  ];

  async run(): Promise<void> {
    const { flags } = this.parse(Create);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      flags,
    });
  }

  async execute({
    logger,
    flags,
  }: {
    logger: ILogger;
    flags: Flags<typeof Create.flags>;
  }): Promise<void> {
    if (
      !flags.profileId &&
      (!flags.providerName || flags.providerName.length === 0) &&
      !flags.interactive
    ) {
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
        const profileInput = await this.inputPrompt(
          'Enter profile Id in format [scope](optional)/[name]'
        );
        if (!profileInput) {
          throw userError('Invalid command! Profile Id must be defined', 1);
        }
        flags.profileId = profileInput;
      }
      //We need provider name
      if (
        (!flags.providerName || flags.providerName.length === 0) &&
        (flags.provider || flags.map)
      ) {
        flags.providerName = [];
        let priority = 1;
        let exit = false;
        const priorityToString: Map<number, string> = new Map([
          [1, 'primary'],
          [2, 'secondary'],
          [3, 'third'],
          [4, 'fourth'],
          [5, 'fifth'],
        ]);
        while (!exit) {
          const providerInput = await this.inputPrompt(
            `Enter provider name of ${
              priorityToString.get(priority) || priority
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
    let profileId: string | undefined = undefined;
    let providerNames: string[] = [];

    //Check inputs
    if (flags.map && !flags.profileId) {
      throw userError('--profileId= must be provided when creating map', 1);
    }
    if (flags.map && !flags.providerName) {
      throw userError('--providerName= must be provided when creating map', 1);
    }
    if (flags.provider && !flags.providerName) {
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
        if (!isValidProviderName(provider)) {
          throw userError(`Invalid provider name: ${provider}`, 1);
        }
        if (
          !provider.startsWith(UNVERIFIED_PROVIDER_PREFIX) &&
          (flags.map || flags.provider)
        ) {
          logger.warn('unverfiedPrefix', provider, UNVERIFIED_PROVIDER_PREFIX);
        }
      }
    }
    providerNames = flags.providerName !== undefined ? flags.providerName : [];

    if (flags.providerFileName && providerNames.length > 1) {
      throw userError(
        `Unable to create mutiple providers with same file name: "${flags.providerFileName}"`,
        1
      );
    }

    if (flags.mapFileName && providerNames.length > 1) {
      throw userError(
        `Unable to create mutiple maps with same file name: "${flags.mapFileName}"`,
        1
      );
    }
    // output a warning when generating profile only and provider is specified
    if (
      flags.profile &&
      !flags.map &&
      !flags.provider &&
      flags.providerName &&
      flags.providerName.length > 0
    ) {
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
    let version: VersionRange | undefined = DEFAULT_PROFILE_VERSION;
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
      if (flags.variant && !isValidDocumentName(flags.variant)) {
        throw userError(`Invalid map variant: ${flags.variant}`, 1);
      }

      //just a sane check
      if (version === undefined) {
        throw developerError('Version must be present', 1);
      }

      // if there is no specified usecase - create usecase with same name as profile name
      usecases =
        flags.usecase !== undefined && flags.usecase.length > 0
          ? flags.usecase
          : [composeUsecaseName(name)];
      for (const usecase of usecases) {
        if (!isValidIdentifier(usecase)) {
          throw userError(`Invalid usecase name: ${usecase}`, 1);
        }
      }
    }

    // create scope directory if it already doesn't exist and we don't have specific path
    if (scope && !flags.path) {
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
        logger.warn('superfaceAlreadyInitialized');
      } else {
        initSf = true;
      }
    }
    //We prompt user
    if (!flags['no-init'] && !flags.init && !superPath) {
      logger.warn('superJsonNotFound');

      const response: { init: boolean } = await inquirer.prompt({
        name: 'init',
        message: 'Would you like to initialize new superface structure?',
        type: 'confirm',
      });

      initSf = response.init;
    }

    //Init SF
    if (initSf) {
      logger.info('initSuperface');
      await initSuperface(
        {
          appPath: NORMALIZED_CWD_PATH,
          initialDocument: { profiles: {}, providers: {} },
        },
        { logger }
      );
      superPath = SUPERFACE_DIR;
    }

    //Do not change superJson
    if (flags['no-super-json']) {
      superPath = undefined;
    }

    await create(
      {
        provider: !!flags.provider,
        map: !!flags.map,
        profile: !!flags.profile,
        fileNames: {
          map: flags.mapFileName,
          profile: flags.profileFileName,
          provider: flags.providerFileName,
        },
        paths: {
          superPath,
          basePath: flags.path,
        },
        document: {
          scope,
          version,
          providerNames,
          usecases,
          name,
          variant: flags.variant,
        },
      },
      { logger }
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
