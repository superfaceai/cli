import { Command, flags } from '@oclif/command';

import {
  CreateMode,
  DocumentStructure,
  inferCreateMode,
  MAP_EXTENSIONS,
  PROFILE_EXTENSIONS,
  ProviderStructure,
  validateInputNames,
} from '../common/document';
import { assertIsIOError, developerError, userError } from '../common/error';
import { makeDirectory, OutputStream } from '../common/io';
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
      description: 'Name of a Provider',
    }),
    variant: flags.string({
      char: 't',
      description: 'Variant of a map',
      dependsOn: ['provider'],
    }),
    version: flags.string({
      char: 'v',
      default: '1.0.0',
      description: 'Version of a profile or map',
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
    '$ superface create sms/service -p twillio',
    '$ superface create sms/service -p twillio -u SendSMS ReceiveSMS',
    '$ superface create sms/service -p twillio --version 1.1-rev132',
    '$ superface create sms/service -p twillio -v 1.1-rev132',
    '$ superface create sms/service -p twillio --variant bugfix --version 1.1-rev133',
    '$ superface create sms/service -p twillio -t bugfix -v 1.1-rev133',
    '$ superface create sms/service@1.1-rev134 -p twillio',
  ];

  async run(): Promise<void> {
    const { argv, flags } = this.parse(Create);

    if (argv.length > 2) {
      throw userError('Invalid command!', 1);
    }

    let createMode = CreateMode.BOTH;
    let documentName = argv[1] ?? argv[0];

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

    let version = flags.version;
    // try to obtain a version from the document name
    if (documentName.includes('@')) {
      version = documentName.slice(documentName.indexOf('@') + 1);
      documentName = documentName.slice(0, documentName.indexOf('@'));
    }

    // fill the document structure with information from document name and flags
    const documentInfo = documentName.split('/');
    const documentStructure: DocumentStructure = {
      profile: documentInfo[1] ?? documentInfo[0],
      scope: documentInfo[1] ? documentInfo[0] : undefined,
      provider: flags.provider,
      variant: flags.variant,
      version,
    };

    // according to new identifier rules - map should always contain scope
    if (createMode !== CreateMode.PROFILE && !documentStructure.scope) {
      throw userError('Invalid document structure.', 1);
    }

    if (
      typeof documentName !== 'string' ||
      !validateInputNames(documentStructure)
    ) {
      throw userError('Invalid document structure.', 1);
    }

    // if there is no specified usecase - create usecase with same name as profile name
    const usecases = flags.usecase ?? [documentStructure.profile];

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
      try {
        await makeDirectory(documentStructure.scope);
      } catch (err) {
        assertIsIOError(err);
        throw userError(`Making directory failed. code: ${err.code}`, 14);
      }
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
    const { profile, scope, version } = documentStructure;

    const documentName = scope ? `${scope}/${profile}` : profile;
    const fileName = `${documentName}${PROFILE_EXTENSIONS[0]}`;
    const outputStream = new OutputStream(fileName);

    await outputStream.write(
      profileTemplate.header(documentName, version) +
        useCaseNames
          .map(usecase => profileTemplate.usecase(template, usecase))
          .join('')
    );
    this.log(
      `-> Created ${fileName} (name = "${documentName}", version = "${version}")`
    );

    await outputStream.cleanup();
  }

  private async createMap(
    documentStructure: DocumentStructure,
    useCaseNames: string[],
    template: mapTemplate.MapTemplateType
  ): Promise<void> {
    const { profile, scope, provider, variant, version } = documentStructure;

    if (!provider || !scope) {
      throw new Error('This should not happen!');
    }

    const documentName = `${scope}/${profile}`;
    const variantName = variant ? `.${variant}` : '';
    const fileName = `${documentName}.${provider}${variantName}${MAP_EXTENSIONS[0]}`;
    const outputStream = new OutputStream(fileName);

    await outputStream.write(
      mapTemplate.header(documentName, provider, version, variant) +
        useCaseNames.map(usecase => mapTemplate.map(template, usecase)).join('')
    );
    this.log(
      `-> Created ${fileName} (profile = "${documentName}@${version}", provider = "${provider}")`
    );

    await outputStream.cleanup();
  }

  private async createProviderJson(name: string): Promise<void> {
    const providerStructure: ProviderStructure = {
      name,
      deployments: [
        {
          id: 'default',
          baseUrl: `https://api.${name}.com`,
        },
      ],
      security: [
        {
          auth: {
            BasicAuth: {
              type: 'http',
              scheme: 'basic',
            },
          },
          hosts: ['default'],
        },
      ],
    };
    const outputStream = new OutputStream(`${name}.provider.json`);

    await outputStream.write(JSON.stringify(providerStructure, null, 2));
    this.log(`-> Created ${name}.provider.json`);

    await outputStream.cleanup();
  }
}
