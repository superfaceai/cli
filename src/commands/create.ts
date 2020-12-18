import { Command, flags } from '@oclif/command';
import { CLIError } from '@oclif/errors';

import { MAP_EXTENSIONS, PROFILE_EXTENSIONS } from '../common/document';
import { OutputStream } from '../common/io';

export enum CapabilityType {
  USECASE = 'usecase',
  MAP = 'map',
}

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
      throw new CLIError('Invalid command!', {
        exit: -1,
      });
    }

    const documentName = argv[1] ?? argv[0];
    let documentType = 'both';
    let usecases: string[];

    if (
      typeof documentName !== 'string' ||
      !/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(documentName)
    ) {
      throw new CLIError('Invalid document name!', {
        exit: -1,
      });
    }

    if (argv.length > 1) {
      documentType = argv[0];
    } else if (
      documentName === 'profile' ||
      documentName === 'map' ||
      documentName === 'both'
    ) {
      throw new CLIError('Name of your document is reserved!', {
        exit: -1,
      });
    }

    // if there is no specified usecase - create usecase with same name as document name
    if (!flags.usecase) {
      usecases = [documentName];
    } else {
      usecases = flags.usecase;
    }

    switch (documentType) {
      case 'profile':
        await this.createProfile(documentName, usecases);
        break;
      case 'map':
        await this.createMap(documentName, usecases, flags.provider);
        break;
      case 'both':
        await this.createMap(documentName, usecases, flags.provider);
        await this.createProfile(documentName, usecases);
        break;
      default:
        throw new CLIError('Invalid document type!', {
          exit: -1,
        });
    }
  }

  async createProfile(
    documentName: string,
    useCaseNames: string[]
  ): Promise<void> {
    const fileName = `${documentName}${PROFILE_EXTENSIONS[0]}`;
    const outputStream = new OutputStream(fileName);

    await outputStream.write(
      `profile = "https://example.com/profile/${documentName}"\n\n${this.getUsecases(
        CapabilityType.USECASE,
        useCaseNames
      )}`
    );

    this.log(
      `-> Created ${fileName} (id = "https://example.com/profile/${documentName}")`
    );

    await outputStream.cleanup();
  }

  async createMap(
    documentName: string,
    useCaseNames: string[],
    providerName?: string
  ): Promise<void> {
    if (!providerName) {
      throw new CLIError('Provider name not found!', {
        exit: -1,
      });
    }

    const fileName = `${documentName}${MAP_EXTENSIONS[0]}`;
    const outputStream = new OutputStream(fileName);

    await outputStream.write(
      `profile = "https://example.com/profile/${documentName}"\nprovider = "https://example.com/${providerName}/${documentName}"\n\n${this.getUsecases(
        CapabilityType.MAP,
        useCaseNames
      )}`
    );

    this.log(
      `-> Created ${fileName} (provider = ${providerName}, id = "https://example.com/${providerName}/${documentName}")`
    );

    await outputStream.cleanup();
  }

  getUsecases(type: CapabilityType, useCaseNames: string[]): string {
    return useCaseNames.map(name => `${type} ${name} {}`).join('\n\n');
  }
}
