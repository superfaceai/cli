import { Command, flags } from '@oclif/command';

import {
  MAP_EXTENSIONS,
  PROFILE_EXTENSIONS,
  validateDocumentName,
} from '../common/document';
import { developerError, userError } from '../common/error';
import { OutputStream } from '../common/io';
import * as mapTemplate from '../templates/map';
import * as profileTemplate from '../templates/profile';

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
    }),
    template: flags.string({
      options: ['empty', 'pubs'],
      default: 'empty',
      description: 'Template to initialize the usecases and maps with',
    }),
    help: flags.help({ char: 'h' }),
  };

  static examples = [
    '$ superface create profile SMSService',
    '$ superface create profile SMSService -u SendSMS ReceiveSMS',
    '$ superface create map SMSService -p Twillio',
    '$ superface create SMSService -p Twillio',
    '$ superface create SMSService -p Twillio -u SendSMS ReceiveSMS',
  ];

  async run(): Promise<void> {
    const { argv, flags } = this.parse(Create);

    if (argv.length > 2) {
      throw userError('Invalid command!', 1);
    }

    const documentName = argv[1] ?? argv[0];
    let documentType = 'both';
    let usecases: string[];

    if (
      typeof documentName !== 'string' ||
      !validateDocumentName(documentName)
    ) {
      throw userError('Invalid document name.', 1);
    }

    if (argv.length > 1) {
      documentType = argv[0];
    } else if (
      documentName === 'profile' ||
      documentName === 'map' ||
      documentName === 'both'
    ) {
      throw userError('Name of your document is reserved!', 1);
    }

    // if there is no specified usecase - create usecase with same name as document name
    if (!flags.usecase) {
      usecases = [documentName];
    } else {
      usecases = flags.usecase;
    }

    // typecheck the template flag
    switch (flags.template) {
      case 'empty':
      case 'pubs':
        break;
      default:
        throw developerError('Invalid --template flag option', 1);
    }

    switch (documentType) {
      case 'profile':
        await this.createProfile(documentName, usecases, flags.template);
        break;
      case 'map':
        if (!flags.provider) {
          throw userError(
            'Provider name must be provided when generating a map.',
            2
          );
        }
        await this.createMap(
          documentName,
          usecases,
          flags.provider,
          flags.template
        );
        break;
      case 'both':
        if (!flags.provider) {
          throw userError(
            'Provider name must be provided when generating a map.',
            2
          );
        }
        await this.createProfile(documentName, usecases, flags.template);
        await this.createMap(
          documentName,
          usecases,
          flags.provider,
          flags.template
        );
        break;
      default:
        throw developerError('Invalid document type!', 1);
    }
  }

  private async createProfile(
    documentName: string,
    useCaseNames: string[],
    template: profileTemplate.UsecaseTemplateType
  ): Promise<void> {
    const fileName = `${documentName}${PROFILE_EXTENSIONS[0]}`;
    const outputStream = new OutputStream(fileName);

    await outputStream.write(
      profileTemplate.header(documentName) +
        useCaseNames
          .map(usecase => profileTemplate.usecase(template, usecase))
          .join('')
    );
    this.log(
      `-> Created ${fileName} (id = "https://example.com/profile/${documentName}")`
    );

    await outputStream.cleanup();
  }

  private async createMap(
    documentName: string,
    useCaseNames: string[],
    providerName: string,
    template: mapTemplate.MapTemplateType
  ): Promise<void> {
    const fileName = `${documentName}${MAP_EXTENSIONS[0]}`;
    const outputStream = new OutputStream(fileName);

    await outputStream.write(
      mapTemplate.header(documentName, providerName) +
        useCaseNames.map(usecase => mapTemplate.map(template, usecase)).join('')
    );
    this.log(
      `-> Created ${fileName} (provider = ${providerName}, id = "https://example.com/${providerName}/${documentName}")`
    );

    await outputStream.cleanup();
  }
}
