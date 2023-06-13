import { flags as oclifFlags } from '@oclif/command';
import { basename, join as joinPath } from 'path';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import { constructProviderSettings } from '../common/document';
import type { UserError } from '../common/error';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { generateSpecifiedProfiles, initSuperface } from '../logic/init';
import { exists } from '../common/io';
import { readFile } from '../common/io';
import { prepareProviderJson } from '../logic/prepare';
import { buildProviderPath } from '../common/file-structure';

export default class Prepare extends Command {
  // TODO: add description
  public static description = 'Creates new API .';

  public static examples = [
    'superface init foo',
    'superface init foo --providers bar twilio',
  ];

  public static args = [
    {
      name: 'urlOrPath',
      description: 'URL or path to the API documentation.',
      required: true,
    },
    {
      name: 'name',
      description:
        'API name. If not provided, it will be inferred from URL or file name.',
      required: false,
    },
  ];

  public static flags = {
    ...Command.flags,
  };

  public async run(): Promise<void> {
    const { flags, args } = this.parse(Prepare);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
      args,
    });
  }

  public async execute({
    logger,
    userError,
    flags,
    args,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Prepare.flags>;
    args: { urlOrPath: string; name?: string };
  }): Promise<void> {
    const { urlOrPath, name } = args;

    const resolved = await resolveSource(urlOrPath, { userError });

    //TODO: parse file name to get name,
    let apiName;
    if (name) {
      apiName = name;
    } else if (resolved.filename !== undefined) {
      apiName = basename(resolved.filename, '.txt');
    }

    // TODO: should take also user error and logger
    const providerJson = await prepareProviderJson(resolved.source, apiName);

    await OutputStream.writeOnce(
      buildProviderPath(providerJson.name),
      JSON.stringify(providerJson, null, 2)
    );
  }
}

async function resolveSource(
  urlOrPath: string,
  { userError }: { userError: UserError }
): Promise<{ filename?: string; source: string }> {
  if (isUrl(urlOrPath)) {
    return { source: urlOrPath };
  }

  if (!/(\.txt|\.json|\.yaml|\.yml)$/gm.test(urlOrPath)) {
    throw userError(
      `Invalid file extension. Supported extensions are: .txt, .json, .yaml, .yml.`,
      1
    );
  }
  if (!(await exists(urlOrPath))) {
    throw userError(`File ${urlOrPath} does not exist.`, 1);
  }

  const content = await readFile(urlOrPath, { encoding: 'utf-8' });

  return { filename: urlOrPath, source: content };
}

function isUrl(maybeUrl: string): boolean {
  try {
    const url = new URL(maybeUrl.trim());

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}
