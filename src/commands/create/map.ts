import { flags as oclifFlags } from '@oclif/command';
import { isValidIdentifier } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { grey, yellow } from 'chalk';
import { join as joinPath } from 'path';

import {
  composeUsecaseName,
  DEFAULT_PROFILE_VERSION_STR,
  META_FILE,
} from '../../common';
import { Command } from '../../common/command.abstract';
import { developerError, userError } from '../../common/error';
import { mkdirQuiet } from '../../common/io';
import { formatShellLog } from '../../common/log';
import { OutputStream } from '../../common/output-stream';
import { createMap } from '../../logic/create';

export default class CreateMap extends Command {
  static strict = false;

  static description =
    'Creates empty map for specified profile on a local filesystem.';

  static args = [
    {
      name: 'profileId',
      required: true,
      description: 'Profile Id - scope(optional) and name of a profile',
    },
  ];

  static flags = {
    ...Command.flags,
    usecase: oclifFlags.string({
      char: 'u',
      multiple: true,
      description: 'Usecases that map contains',
    }),
    provider: oclifFlags.string({
      char: 'p',
      description: 'Name of a Provider',
      required: true,
    }),
    variant: oclifFlags.string({
      char: 't',
      description: 'Variant of a map',
      dependsOn: ['provider'],
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
    '$ superface create:map sms/service -p twillio',
    '$ superface create:map sms/service -p twillio -u SendSMS ReceiveSMS',
  ];

  private warnCallback? = (message: string) => this.log(yellow(message));
  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { argv, flags } = this.parse(CreateMap);

    //Check input
    const documentName = argv[0];

    if (
      documentName === 'profile' ||
      documentName === 'map' ||
      documentName === 'both'
    ) {
      throw userError('Name of your document is reserved!', 1);
    }

    const providerName = flags.provider ? `.${flags.provider}` : '';
    const variant = flags.variant ? `.${flags.variant}` : '';
    const documentId = `${documentName}${providerName}${variant}@${DEFAULT_PROFILE_VERSION_STR}`;
    const documentResult = parseDocumentId(documentId);

    if (documentResult.kind === 'error') {
      throw userError(documentResult.message, 1);
    }

    // compose document structure from the result
    const documentStructure = documentResult.value;
    const {
      scope,
      version,
      middle: [name, provider],
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

    // create scope directory if it already doesn't exist
    if (scope) {
      await mkdirQuiet(scope);
    }

    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;
    }

    const superPath = await this.getSuperPath(flags.scan, {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
    });

    // typecheck the template flag
    switch (flags.template) {
      case 'empty':
      case 'pubs':
        break;
      default:
        throw developerError('Invalid --template flag option', 1);
    }

    //Load super json
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
    const superJson = loadedResult.match(
      v => v,
      err => {
        this.warnCallback?.(err);

        return new SuperJson({});
      }
    );

    await createMap(
      '',
      superJson,
      { scope, name, provider, variant, version },
      usecases,
      flags.template,
      {
        logCb: this.logCallback,
      }
    );

    // write new information to super.json
    await OutputStream.writeOnce(superJson.path, superJson.stringified);
    this.logCallback?.(
      formatShellLog("echo '<updated super.json>' >", [superJson.path])
    );
  }
}
