import { Command, flags } from '@oclif/command';

import { userError } from '../common/error';

import { MAP_EXTENSIONS, PROFILE_EXTENSIONS, validateDocumentName } from '../common/document';
import { OutputStream } from '../common/io';

export enum CapabilityType {
  USECASE = 'usecase',
  MAP = 'map',
}

export default class Create extends Command {
  static description = 'Creates empty map and profile on a local filesystem.';

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
    })
  };

  async run(): Promise<void> {
    const { args, flags } = this.parse(Create);
    const { documentName } = args;
    let usecases: string[];

    if (
      typeof documentName !== 'string' || !validateDocumentName(documentName)
    ) {
      throw userError('Invalid document name', 1);
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
      throw userError('Provider name not found', 2);
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
