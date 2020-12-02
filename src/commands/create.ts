import { Command, flags } from '@oclif/command';

import { developerError, userError } from '../common/error';

import { MAP_EXTENSIONS, PROFILE_EXTENSIONS, validateDocumentName } from '../common/document';
import { OutputStream } from '../common/io';

import * as profileTemplate from '../templates/profile';
import * as mapTemplate from '../templates/map';

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
    }),
    template: flags.string({
      options: ['empty', 'pubs'],
      default: 'empty',
      description: 'Template to initialize the usecases and maps with'
    })
  };

  async run(): Promise<void> {
    const { args, flags } = this.parse(Create);
    const { documentName } = args;
    let usecases: string[];

    if (
      typeof documentName !== 'string' || !validateDocumentName(documentName)
    ) {
      throw userError('Invalid document name.', 1);
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

    switch (flags.documentType) {
      case 'profile':
        await this.createProfile(documentName, usecases, flags.template);
        break;
      case 'map':
        if (!flags.provider) {
          throw userError('Provider name must be provided when generating a map.', 2);
        }
        await this.createMap(documentName, usecases, flags.provider, flags.template);
        break;
      case 'both':
        if (!flags.provider) {
          throw userError('Provider name must be provided when generating a map.', 2);
        }
        await this.createProfile(documentName, usecases, flags.template);
        await this.createMap(documentName, usecases, flags.provider, flags.template);
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
      profileTemplate.header(documentName) + useCaseNames.map(
        usecase => profileTemplate.usecase(template, usecase)
      ).join('')
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
      mapTemplate.header(documentName, providerName) + useCaseNames.map(
        usecase => mapTemplate.map(template, usecase)
      ).join('')
    );
    this.log(
      `-> Created ${fileName} (provider = ${providerName}, id = "https://example.com/${providerName}/${documentName}")`
    );

    await outputStream.cleanup();
  }
}
