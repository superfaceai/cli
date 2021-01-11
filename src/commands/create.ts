import { Command, flags } from '@oclif/command';
import { parseMapId, parseProfileId } from '@superfaceai/parser';

import {
  composeStructure,
  composeVersion,
  CreateMode,
  DEFAULT_PROFILE_VERSION,
  DocumentStructure,
  inferCreateMode,
  MAP_EXTENSIONS,
  PROFILE_EXTENSIONS,
  validateDocumentName,
} from '../common/document';
import { developerError, userError } from '../common/error';
import { mkdirQuiet, OutputStream } from '../common/io';
import * as mapTemplate from '../templates/map';
import * as profileTemplate from '../templates/profile';
import { defaultProvider } from '../templates/provider';

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
      default: DEFAULT_PROFILE_VERSION,
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

    if (flags.provider && createMode === CreateMode.PROFILE) {
      throw userError(
        'Provider should not be specified when generating a profile',
        1
      );
    }

    // parse document name and flags
    const provider = flags.provider ? `.${flags.provider}` : '';
    const variant = flags.variant ? `.${flags.variant}` : '';
    const version =
      createMode === CreateMode.MAP ? DEFAULT_PROFILE_VERSION : flags.version;
    const documentId = `${documentName}${provider}${variant}@${version}`;
    const documentResult =
      createMode === CreateMode.PROFILE
        ? parseProfileId(documentId)
        : parseMapId(documentId);

    if (documentResult.kind === 'error') {
      throw userError(documentResult.message, 1);
    }

    // compose document structure from the result
    const documentStructure = composeStructure(documentResult);

    // if there is no specified usecase - create usecase with same name as profile name
    const usecases = flags.usecase ?? [documentStructure.name];
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
    if (documentStructure.scope) {
      await mkdirQuiet(documentStructure.scope);
    }

    switch (createMode) {
      case CreateMode.PROFILE:
        await this.createProfile(documentStructure, usecases, flags.template);
        break;
      case CreateMode.MAP:
        if (!documentStructure.provider) {
          throw userError(
            'Provider name must be provided when generating a map.',
            2
          );
        }
        await this.createMap(documentStructure, usecases, flags.template);
        await this.createProviderJson(documentStructure.provider);
        break;
      case CreateMode.BOTH:
        if (!documentStructure.provider) {
          throw userError(
            'Provider name must be provided when generating a map.',
            2
          );
        }
        await this.createProfile(documentStructure, usecases, flags.template);
        await this.createMap(documentStructure, usecases, flags.template);
        await this.createProviderJson(documentStructure.provider);
        break;
    }
  }

  private async createProfile(
    documentStructure: DocumentStructure,
    useCaseNames: string[],
    template: profileTemplate.UsecaseTemplateType
  ): Promise<void> {
    const { name, scope } = documentStructure;

    const documentName = scope ? `${scope}/${name}` : name;
    const version = composeVersion(documentStructure.version);
    const fileName = `${documentName}${PROFILE_EXTENSIONS[0]}`;

    await OutputStream.writeOnce(
      fileName,
      profileTemplate.header(documentName, version) +
        useCaseNames
          .map(usecase => profileTemplate.usecase(template, usecase))
          .join('')
    );

    this.log(
      `-> Created ${fileName} (name = "${documentName}", version = "${version}")`
    );
  }

  private async createMap(
    documentStructure: DocumentStructure,
    useCaseNames: string[],
    template: mapTemplate.MapTemplateType
  ): Promise<void> {
    const { name, scope, provider, variant } = documentStructure;

    if (!provider) {
      throw developerError('Document structure is complete', 1);
    }

    const documentName = scope ? `${scope}/${name}` : name;
    const version = composeVersion(documentStructure.version);
    const variantName = variant ? `.${variant}` : '';
    const fileName = `${documentName}.${provider}${variantName}${MAP_EXTENSIONS[0]}`;

    await OutputStream.writeOnce(
      fileName,
      mapTemplate.header(documentName, provider, version, variant) +
        useCaseNames.map(usecase => mapTemplate.map(template, usecase)).join('')
    );

    this.log(
      `-> Created ${fileName} (profile = "${documentName}@${version}", provider = "${provider}")`
    );
  }

  private async createProviderJson(name: string): Promise<void> {
    await OutputStream.writeOnce(
      `${name}.provider.json`,
      defaultProvider(name)
    );

    this.log(`-> Created ${name}.provider.json`);
  }
}
