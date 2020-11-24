import { Command, flags } from '@oclif/command';
import { CLIError } from '@oclif/errors';

import {
  DocumentType,
  MAP_EXTENSIONS,
  PROFILE_EXTENSIONS,
} from '../common/document';
import { OutputStream } from '../common/io';

export default class Create extends Command {
  static description = 'Creates empty map and profile on a local filesystem.';

  static strict = false;

  static args = [
    {
      name: 'documentName',
      required: true,
      description: 'Document name of profile or map',
    },
  ];

  static flags = {
    documentType: flags.string({
      char: 't',
      options: ['profile', 'map', 'both'],
      default: 'both',
    }),
    usecase: flags.string({
      char: 'u',
      multiple: true,
      description: 'Usecases that profile or map contains',
    }),
    provider: flags.string({
      char: 'p',
      options: ['Twillio', 'Tyntec'],
      default: 'Twillio',
    }),
    outputFormat: flags.string({
      char: 'f',
      description: 'Format of created profile or map.',
      options: ['text', 'json'],
      default: 'text',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = this.parse(Create);
    const { documentName } = args;
    let usecases: string[];

    if (typeof documentName !== 'string') {
      throw new CLIError('Invalid document name!', {
        exit: -1,
      });
    }

    // if there is no specified usecase - create usecase with same name as document name
    if (!flags.usecase) {
      usecases = [documentName];
    } else {
      usecases = flags.usecase;
    }

    switch (flags.documentType) {
      case 'profile':
        await this.createProfile(documentName, usecases);
        break;
      case 'map':
        await this.createMap(documentName, usecases, flags.provider);
        break;
      case 'both':
        await this.createProfile(documentName, usecases);
        await this.createMap(documentName, usecases, flags.provider);
    }
  }

  async createProfile(
    documentName: string,
    useCaseNames: string[]
  ): Promise<void> {
    const fileName = `${documentName}${PROFILE_EXTENSIONS[0]}`;
    const outputStream = new OutputStream(`${__dirname}/${fileName}`);

    await outputStream.write(
      this.getDocument(DocumentType.PROFILE, documentName, useCaseNames)
    );

    this.log(
      `-> Created ${fileName} (id = "https://example.com/profile/${documentName}")`
    );

    await outputStream.cleanup();
  }

  async createMap(
    documentName: string,
    useCaseNames: string[],
    providerName: string
  ): Promise<void> {
    const fileName = `${documentName}${MAP_EXTENSIONS[0]}`;
    const outputStream = new OutputStream(`${__dirname}/${fileName}`);

    await outputStream.write(
      this.getDocument(
        DocumentType.MAP,
        documentName,
        useCaseNames,
        providerName
      )
    );

    this.log(
      `-> Created ${fileName} (provider = ${providerName}, id = "https://example.com/${providerName}/${documentName}")`
    );

    await outputStream.cleanup();
  }

  getDocument(
    type: DocumentType,
    documentName: string,
    useCaseNames: string[],
    providerName?: string
  ): string {
    if (type === 'profile') {
      return `profile = "https://example.com/profile/${documentName}"\n\n${this.getUsecases(
        type,
        useCaseNames
      )}`;
    }

    if (!providerName) {
      throw new CLIError('Provider name not specified!', {
        exit: -1,
      });
    }

    return `profile = "https://example.com/profile/${documentName}"\nprovider = "https://example.com/${providerName}/${documentName}"\n\n${this.getUsecases(
      type,
      useCaseNames
    )}`;
  }

  getUsecases(type: DocumentType, useCaseNames: string[]): string {
    if (type === 'profile') {
      return useCaseNames
        .map(useCaseName => `usecase ${useCaseName} {}`)
        .join('\n\n');
    }

    return useCaseNames
      .map(useCaseName => `map ${useCaseName} {}`)
      .join('\n\n');
  }
}
