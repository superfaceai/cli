import { flags as oclifFlags } from '@oclif/command';
import type { ProviderJson } from '@superfaceai/ast';
import { isValidProviderName } from '@superfaceai/ast';
import { basename, extname } from 'path';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import {
  buildProviderPath,
  buildSuperfaceDirPath,
} from '../common/file-structure';
import { formatPath } from '../common/format';
import { exists, mkdir, readFile } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { DEFAULT_POLLING_TIMEOUT_SECONDS } from '../common/polling';
import { UX } from '../common/ux';
import { prepareProviderJson } from '../logic/prepare';

export default class Prepare extends Command {
  public static description = `Learns API from the documentation and prepares the API metadata.
  
  The supported documentation formats are:
  - OpenAPI specification (via URL or local file)
  - documentation hosted on ReadMe.io (via URL)
  - plain text (see below)
  
If you want to use plain text documentation you need to format the docs with **the separator**. The documentation conventionally consists of various topics, usually set apart by separate pages or big headings. They might be _authentication, rate limiting, general rules, API operations (sometimes grouped by resources)_.

It's highly recommended each of these topics (or chunks) is set apart in the docs provided for Superface, too. For that, we use _the separator_.

The separator is a long \`===========\` ended with a newline. Technically 5 _equal_ characters are enough to form a separator. The API docs ready for the ingest might look something like the following:

\`
# Welcome to our docs
(...)
================================
# API Basics
(...)
================================
# Authorizing Requests
(...)
================================
# /todos/:id/items
This endpoint lists all items (...)
================================
(...)
\`
This command prepares a Provider JSON metadata definition that can be used to generate the integration code. Superface tries to fill as much as possibe from the API documentation, but some parts are required to be filled manually. You can find the prepared provider definition in the \`superface/\` directory in the current working directory.`;

  public static examples = [
    'superface prepare https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/openai.com/1.2.0/openapi.yaml',
    'superface prepare https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/openai.com/1.2.0/openapi.yaml openai',
    'superface prepare path/to/openapi.json',
    'superface prepare https://workable.readme.io/reference/stages workable',
    'superface prepare https://workable.readme.io/reference/stages workable --verbose',
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
    verbose: oclifFlags.boolean({
      char: 'v',
      required: false,
      description:
        'When set to true command will print the indexed documentation overview. This is useful for debugging.',
      default: false,
    }),
    force: oclifFlags.boolean({
      required: false,
      description:
        'When set to true command will overwrite existing Provider JSON metadata.',
      default: false,
    }),
    timeout: oclifFlags.integer({
      char: 't',
      required: false,
      description: `Operation timeout in seconds. If not provided, it will be set to ${DEFAULT_POLLING_TIMEOUT_SECONDS} seconds. Useful for large API documentations.`,
      default: DEFAULT_POLLING_TIMEOUT_SECONDS,
    }),
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
    const ux = UX.create();
    const { urlOrPath, name } = args;

    ux.start('Resolving inputs');

    if (urlOrPath === undefined) {
      throw userError(
        'Missing first argument, please provide URL or filepath of API documentation.',
        1
      );
    }

    const resolved = await resolveInputs(urlOrPath, name, {
      userError,
    });

    ux.start('Preparing provider definition');
    const providerJsonResult = await prepareProviderJson(
      {
        urlOrSource: resolved.source,
        name: resolved.name,
        options: {
          quiet: flags.quiet,
          getDocs: flags.verbose,
          timeout: flags.timeout,
          force: flags.force ?? false,
        },
      },
      { userError, ux }
    );

    const docs = providerJsonResult.docs
      ? `\n{bold Indexed documentation:}{grey \n${providerJsonResult.docs
          .map(d => d.replace(/{/g, '\\{').replace(/}/g, '\\}'))
          .join('\n')}\n}`
      : ``;

    const providerJson = providerJsonResult.definition;

    const providerJsonPath = await writeProviderJson(
      providerJsonResult.definition,
      {
        logger,
        userError,
      }
    );

    if (
      providerJson.services.length === 0 ||
      (providerJson.services.length === 1 &&
        providerJson.services[0].baseUrl.includes('TODO'))
    ) {
      ux.warn(`{inverse  ACTION REQUIRED }
Documentation was indexed but the Provider definition requires attention.

1) Edit '{bold ${formatPath(
        providerJsonPath
      )}}'. See {underline https://sfc.is/editing-providers}

2) Create a new Comlink profile using:
{bold superface new ${providerJson.name} "use case description"}
${docs}`);
    } else {
      ux.succeed(
        `Provider definition saved to '${formatPath(providerJsonPath)}'.

Create a new Comlink profile using:
{bold superface new ${providerJson.name} "use case description"}
${docs}`
      );
    }
  }
}

export async function writeProviderJson(
  providerJson: ProviderJson,
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<string> {
  // TODO: force flag
  if (await exists(buildProviderPath(providerJson.name))) {
    throw userError(`Provider ${providerJson.name} already exists.`, 1);
  }

  if (!(await exists(buildSuperfaceDirPath()))) {
    logger.info('sfDirectory');
    await mkdir(buildSuperfaceDirPath(), { recursive: true });
  }

  const path = buildProviderPath(providerJson.name);

  await OutputStream.writeOnce(path, JSON.stringify(providerJson, null, 2));

  return path;
}

async function resolveInputs(
  urlOrPath: string,
  name: string | undefined,
  { userError }: { userError: UserError }
): Promise<{
  source: string;
  name?: string;
}> {
  const resolvedSource = await resolveSource(urlOrPath, { userError });

  let apiName: string | undefined = undefined;
  if (name !== undefined) {
    if (!isValidProviderName(name)) {
      throw userError(
        `Invalid provider name '${name}'. Provider name must match: ^[a-z][_\\-a-z]*$`,
        1
      );
    }

    apiName = name;
  } else if (resolvedSource.filename !== undefined) {
    // Try to infer name from filename
    apiName = basename(
      resolvedSource.filename,
      extname(resolvedSource.filename)
      // replace special characters with dashes
    )
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, '-');

    if (!isValidProviderName(apiName)) {
      throw userError(
        `Provider name inferred from file name is not valid. Please provide provider name explicitly as second argument.`,
        1
      );
    }
  }

  return {
    source: resolvedSource.source,
    name: apiName,
  };
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

  let content: string;
  try {
    content = await readFile(urlOrPath, { encoding: 'utf-8' });
  } catch (e) {
    throw userError(`Could not read file ${urlOrPath}.`, 1);
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
