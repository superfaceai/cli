import { Command, flags } from '@oclif/command';
import { parseDocumentId } from '@superfaceai/parser';

import {
  composeUsecaseName,
  DEFAULT_PROFILE_VERSION_STR,
  inferCreateMode,
  validateDocumentName,
} from '../common/document';
import { CreateMode } from '../common/document.interfaces';
import { developerError, userError } from '../common/error';
import { mkdirQuiet } from '../common/io';
import { createMap, createProfile, createProviderJson } from '../logic/create';

export default class Create extends Command {
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
    usecase: flags.string({
      char: 'u',
      multiple: true,
      description: 'Usecases that profile or map contains',
    }),
    provider: flags.string({
      char: 'p',
      description: 'Name of a Provider',
    }),
    variant: flags.string({
      char: 't',
      description: 'Variant of a map',
      dependsOn: ['provider'],
    }),
    version: flags.string({
      char: 'v',
      default: DEFAULT_PROFILE_VERSION_STR,
      description: 'Version of a profile',
    }),
    template: flags.string({
      options: ['empty', 'pubs'],
      default: 'empty',
      description: 'Template to initialize the usecases and maps with',
    }),
    help: flags.help({ char: 'h' }),
  };

  static examples = [
    '$ superface create profile sms/service',
    '$ superface create profile sms/service -u SendSMS ReceiveSMS',
    '$ superface create map sms/service -p twillio',
    '$ superface create map sms/service -p twillio -u SendSMS ReceiveSMS',
    '$ superface create sms/service -p twillio -u SendSMS ReceiveSMS',
    '$ superface create sms/service -p twillio -t bugfix -v 1.1-rev133 -u SendSMS ReceiveSMS',
  ];

  private logCallback? = (message: string) => this.log(message);

  async run(): Promise<void> {
    const { argv, flags } = this.parse(Create);

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
    const { scope, middle: [name, provider], version } = documentStructure;

    if (version === undefined) {
      throw developerError('version must be present', 1);
    }

    // if there is no specified usecase - create usecase with same name as profile name
    const usecases = flags.usecase ?? [composeUsecaseName(name)];
    for (const usecase of usecases) {
      if (!validateDocumentName(usecase)) {
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

    switch (createMode) {
      case CreateMode.PROFILE:
        await createProfile(
          '',
          { scope, name, version },
          usecases,
          flags.template,
          { logCb: this.logCallback }
        );
        break;
      case CreateMode.MAP:
        if (!provider) {
          throw userError(
            'Provider name must be provided when generating a map.',
            2
          );
        }
        await createMap(
          '',
          { scope, name, provider, version },
          usecases,
          flags.template,
          { logCb: this.logCallback }
        );
        await createProviderJson('', provider, { logCb: this.logCallback });
        break;
      case CreateMode.BOTH:
        if (!provider) {
          throw userError(
            'Provider name must be provided when generating a map.',
            2
          );
        }
        await createProfile(
          '',
          { scope, name, version },
          usecases,
          flags.template,
          { logCb: this.logCallback }
        );
        await createMap(
          '',
          { scope, name, provider, version },
          usecases,
          flags.template,
          { logCb: this.logCallback }
        );
        await createProviderJson('', provider, { logCb: this.logCallback });
        break;
    }
  }
}
