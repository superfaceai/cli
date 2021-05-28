import { flags as oclifFlags } from '@oclif/command';
import { isValidIdentifier } from '@superfaceai/ast';
import { parseDocumentId } from '@superfaceai/parser';
import { grey, yellow } from 'chalk';
import inquirer from 'inquirer';

import { Command } from '../common/command.abstract';
import {
  composeUsecaseName,
  DEFAULT_PROFILE_VERSION_STR,
  inferCreateMode,
  SUPERFACE_DIR,
} from '../common/document';
import { CreateMode } from '../common/document.interfaces';
import { developerError, userError } from '../common/error';
import { mkdirQuiet } from '../common/io';
import { create } from '../logic/create';
import { initSuperface } from '../logic/init';
import { detectSuperJson } from '../logic/install';

export default class Create extends Command {
  // hide the command from help
  static hidden = true;

  static strict = false;

  static description = 'Creates empty map and profile on a local filesystem.';

  static args = [
    {
      name: 'documentInfo',
      required: true,
      description:
        'Two arguments containing informations about the document.\n1. Document Type (optional) - type of document that will be created (profile or map), if not specified, utility will create both\n2. Document Name - name of a file that will be created',
    },
  ];

  static flags = {
    ...Command.flags,
    usecase: oclifFlags.string({
      char: 'u',
      multiple: true,
      description: 'Usecases that profile or map contains',
    }),
    provider: oclifFlags.string({
      char: 'p',
      description: 'Name of a Provider',
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
    template: oclifFlags.string({
      options: ['empty', 'pubs'],
      default: 'empty',
      description: 'Template to initialize the usecases and maps with',
    }),
    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
  };

  static examples = [
    '$ superface create profile sms/service',
    '$ superface create profile sms/service -u SendSMS ReceiveSMS',
    '$ superface create map sms/service -p twilio',
    '$ superface create map sms/service -p twilio -u SendSMS ReceiveSMS',
    '$ superface create sms/service -p twilio -u SendSMS ReceiveSMS',
    '$ superface create sms/service -p twilio -t bugfix -v 1.1-rev133 -u SendSMS ReceiveSMS',
  ];

  private warnCallback? = (message: string) => this.log(yellow(message));
  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { argv, flags } = this.parse(Create);

    //Warn user
    this.log(
      yellow(
        'You are using a hidden command. This command is not intended for public consumption yet. It might be broken, hard to use or simply redundant. Tread with care.'
      )
    );

    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;
    }

    if (argv.length > 2) {
      throw userError('Invalid command!', 1);
    }

    let createMode = CreateMode.BOTH;
    const documentName = argv[1] ?? argv[0];

    if (argv.length > 1) {
      createMode = inferCreateMode(argv[0]);

      if (createMode === CreateMode.UNKNOWN) {
        throw userError('Could not infer create mode', 3);
      }
    } else if (
      documentName === 'profile' ||
      documentName === 'map' ||
      documentName === 'both'
    ) {
      throw userError('Name of your document is reserved!', 1);
    }

    // output a warning when generating profile only and provider is specified
    if (createMode === CreateMode.PROFILE && flags.provider) {
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
      createMode === CreateMode.MAP &&
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

    // typecheck the template flag
    switch (flags.template) {
      case 'empty':
      case 'pubs':
        break;
      default:
        throw developerError('Invalid --template flag option', 1);
    }

    // create scope directory if it already doesn't exist
    if (scope) {
      await mkdirQuiet(scope);
    }

    let superPath = await detectSuperJson(process.cwd(), flags.scan);

    if (!superPath) {
      this.warnCallback?.("File 'super.json' has not been found.");

      const response: { init: boolean } = await inquirer.prompt({
        name: 'init',
        message: 'Would you like to initialize new superface structure?',
        type: 'confirm',
      });

      if (!response.init) {
        this.exit();
      }

      this.logCallback?.(
        "Initializing superface directory with empty 'super.json'"
      );
      await initSuperface(
        './',
        { profiles: {}, providers: {} },
        { logCb: this.logCallback }
      );
      superPath = SUPERFACE_DIR;
    }

    await create(
      superPath,
      createMode,
      usecases,
      {
        scope,
        version,
        middle: documentStructure.middle,
      },
      flags.template,
      {
        logCb: this.logCallback,
        warnCb: this.warnCallback,
      }
    );
  }
}
