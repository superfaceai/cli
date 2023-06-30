import type { ProviderJson } from '@superfaceai/ast';
import { basename, extname } from 'path';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import {
  buildProviderPath,
  buildSuperfaceDirPath,
} from '../common/file-structure';
import { exists, mkdir, readFile } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { UX } from '../common/ux';
import { prepareProviderJson } from '../logic/prepare';

export default class Prepare extends Command {
  // TODO: add description
  public static description =
    'Prepares API documentation for integration generation from provider URL or local file with OpenAPI specification in yaml or json format. Or from the URL to the readme.io dev portal.  This command prepares a provider definition that can be used to generate integration code.';

  public static examples = [
    'superface prepare https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/openai.com/1.2.0/openapi.yaml',
    'superface prepare https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/openai.com/1.2.0/openapi.yaml openai',
    'superface prepare prepare path/to/openapi.json',
    'superface prepare prepare https://workable.readme.io/reference/stages',
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
    args: { urlOrPath?: string; name?: string };
  }): Promise<void> {
    const ux = new UX();
    const { urlOrPath, name } = args;

    if (urlOrPath === undefined) {
      throw userError(
        'Missing first argument, please provide URL or filepath of API documentation.',
        1
      );
    }

    const resolved = await resolveInputs(urlOrPath, name, {
      userError,
      ux,
    });

    // TODO: should take also user error?
    const providerJson = await prepareProviderJson(
      {
        urlOrSource: resolved.source,
        name: resolved.name,
        options: { quiet: flags.quiet },
      },
      { logger }
    );

    await writeProviderJson(providerJson, { logger, userError, ux });
  }
}

export async function writeProviderJson(
  providerJson: ProviderJson,
  { logger, userError, ux }: { logger: ILogger; userError: UserError; ux: UX }
): Promise<void> {
  // TODO: force flag
  if (await exists(buildProviderPath(providerJson.name))) {
    throw userError(`Provider ${providerJson.name} already exists.`, 1, ux);
  }

  if (!(await exists(buildSuperfaceDirPath()))) {
    logger.info('sfDirectory');
    await mkdir(buildSuperfaceDirPath(), { recursive: true });
  }

  await OutputStream.writeOnce(
    buildProviderPath(providerJson.name),
    JSON.stringify(providerJson, null, 2)
  );
}

async function resolveInputs(
  urlOrPath: string,
  name: string | undefined,
  { userError, ux }: { userError: UserError; ux: UX }
): Promise<{
  source: string;
  name?: string;
}> {
  ux.start('Resolving inputs');

  // slep for 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));

  const resolvedSource = await resolveSource(urlOrPath, { userError, ux });

  let apiName;
  if (name !== undefined) {
    apiName = name;
  } else if (resolvedSource.filename !== undefined) {
    apiName = basename(
      resolvedSource.filename,
      extname(resolvedSource.filename)
    );
  }

  ux.succeed('Resolved inputs');

  return {
    source: resolvedSource.source,
    name: apiName,
  };
}

async function resolveSource(
  urlOrPath: string,
  { userError, ux }: { userError: UserError; ux: UX }
): Promise<{ filename?: string; source: string }> {
  if (isUrl(urlOrPath)) {
    return { source: urlOrPath };
  }

  if (!/(\.txt|\.json|\.yaml|\.yml)$/gm.test(urlOrPath)) {
    throw userError(
      `Invalid file extension. Supported extensions are: .txt, .json, .yaml, .yml.`,
      1,
      ux
    );
  }

  if (!(await exists(urlOrPath))) {
    throw userError(`File ${urlOrPath} does not exist.`, 1, ux);
  }

  let content: string;
  try {
    content = await readFile(urlOrPath, { encoding: 'utf-8' });
  } catch (e) {
    throw userError(`Could not read file ${urlOrPath}.`, 1, ux);
  }

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
