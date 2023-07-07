import type { ProviderJson } from '@superfaceai/ast';
import {
  AssertionError,
  assertProviderJson,
  isValidProviderName,
} from '@superfaceai/ast';
import { basename } from 'path';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import { stringifyError, type UserError } from '../common/error';
import { buildProfilePath, buildProviderPath } from '../common/file-structure';
import { exists, readFile } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { UX } from '../common/ux';
import { newProfile } from '../logic/new';
import { SuperfaceClient } from '../common/http';

const MAX_PROMPT_LENGTH = 200;

export default class New extends Command {
  // TODO: add description
  public static description =
    'Creates new Comlink Profile for your use case based on the selected API. Comlink Profile defines the interface of the API integration. Use name of API provider as the first argument followed by the description of your use case. You need to run `superface prepare` command before running this command.';

  public static examples = [
    'superface new swapi "retrieve character\'s homeworld by their name"',
    'superface new resend "Send email to user"',
  ];

  public static args = [
    {
      name: 'providerName',
      description: 'URL or path to the API documentation.',
      required: true,
    },
    {
      name: 'prompt',
      description:
        'API name. If not provided, it will be inferred from URL or file name.',
      required: false,
    },
  ];

  public static flags = {
    ...Command.flags,
  };

  public async run(): Promise<void> {
    const { flags, args } = this.parse(New);
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
    flags: Flags<typeof New.flags>;
    args: { providerName?: string; prompt?: string };
  }): Promise<void> {
    const ux = UX.create();
    const { providerName, prompt } = args;

    ux.start('Checking input arguments');

    checkPrompt(prompt, { userError });

    const resolvedProviderJson = await resolveProviderJson(providerName, {
      userError,
    });

    if (resolvedProviderJson.source === 'local') {
      ux.succeed(
        `Input arguments checked. Provider JSON resolved from local file ${resolvedProviderJson.path}`
      );
    } else {
      ux.succeed(
        `Input arguments checked. Provider JSON resolved from Superface server`
      );
    }

    ux.start('Creating profile for your use case');
    // TODO: should take also user error?
    const profile = await newProfile(
      {
        providerJson: resolvedProviderJson.providerJson,
        prompt: prompt,
        options: { quiet: flags.quiet },
      },
      { logger, userError, ux }
    );
    ux.succeed('Profile created');

    ux.start('Saving profile for your use case');
    const profilePath = await saveProfile(profile, { logger, userError });

    ux.succeed(
      `Profile saved to ${profilePath}. You can use it to generate integration code for your use case by running 'superface map ${
        resolvedProviderJson.providerJson.name
      } ${ProfileId.fromScopeName(profile.scope, profile.name).id}'`
    );
  }
}

async function saveProfile(
  { source, scope, name }: { source: string; scope?: string; name: string },
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<string> {
  const profilePath = buildProfilePath(scope, name);

  logger.info('saveProfile', profilePath);

  // TODO: force flag? or overwrite by default?
  if (await exists(profilePath)) {
    throw userError(`Profile ${basename(profilePath)} already exists.`, 1);
  }

  await OutputStream.writeOnce(profilePath, source);

  return profilePath;
}

function checkPrompt(
  prompt: string | undefined,
  { userError }: { userError: UserError }
): asserts prompt is string {
  if (prompt === undefined) {
    throw userError(
      'Missing short description of your use case in natural language. Please provide it as second argument.',
      1
    );
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw userError(
      `Description of your use case is too long. Maximum length is ${MAX_PROMPT_LENGTH} characters.`,
      1
    );
  }
}

// TODO: move to common
export async function resolveProviderJson(
  providerName: string | undefined,
  { userError }: { userError: UserError }
): Promise<
  {
    providerJson: ProviderJson;
  } & ({ source: 'local'; path: string } | { source: 'remote' })
> {
  if (providerName === undefined) {
    throw userError(
      'Missing provider name. Please provide it as first argument.',
      1
    );
  }

  if (!isValidProviderName(providerName)) {
    throw userError('Invalid provider name', 1);
  }

  let resolvedProviderJson: ProviderJson | undefined;
  let source: 'local' | 'remote' = 'local';
  let path: string;

  if (!(await exists(buildProviderPath(providerName)))) {
    const client = SuperfaceClient.getClient();

    try {
      const providerResponse = await client.fetch(
        `/authoring/providers/${providerName}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
          },
        }
      );

      if (providerResponse.status === 200) {
        try {
          resolvedProviderJson = assertProviderJson(
            (await providerResponse.json()) as ProviderJson
          );
        } catch (e) {
          if (e instanceof AssertionError) {
            throw userError(`Invalid provider.json file. ${e.message}`, 1);
          }
          throw userError(`Invalid provider.json file.`, 1);
        }
      } else if (providerResponse.status === 404) {
        throw userError(
          `Provider ${providerName} does not exist both locally and remotely. Make sure to run "sf prepare" before running this command.`,
          1
        );
      } else {
        throw userError(
          `Failed to fetch provider.json file from Superface API. ${stringifyError(
            providerResponse
          )}`,
          1
        );
      }
    } catch (e) {
      throw userError(
        `Failed to fetch provider.json file from Superface API. ${stringifyError(
          e
        )}`,
        1
      );
    }

    await OutputStream.writeOnce(
      buildProviderPath(resolvedProviderJson.name),
      JSON.stringify(resolvedProviderJson, null, 2)
    );
  } else {
    path = buildProviderPath(providerName);
    const providerJsonFile = await readFile(path, 'utf-8');
    let providerJson: ProviderJson;
    try {
      providerJson = JSON.parse(providerJsonFile) as ProviderJson;
    } catch (e) {
      throw userError(`Invalid provider.json file.`, 1);
    }

    try {
      resolvedProviderJson = assertProviderJson(providerJson);
    } catch (e) {
      if (e instanceof AssertionError) {
        throw userError(`Invalid provider.json file. ${e.message}`, 1);
      }
      throw userError(`Invalid provider.json file.`, 1);
    }
  }

  if (providerName !== resolveProviderJson.name) {
    throw userError(
      `Provider name in provider.json file does not match provider name in command.`,
      1
    );
  }

  if (
    resolvedProviderJson.services.length === 1 &&
    resolvedProviderJson.services[0].baseUrl.includes('TODO')
  ) {
    throw userError(
      `Provider.json file is not properly configured. Please make sure to replace 'TODO' in baseUrl with the actual base url of the API.`,
      1
    );
  }

  if (source === 'local') {
    return {
      providerJson: resolvedProviderJson,
      source,
      path: path!,
    };
  }

  return {
    providerJson: resolvedProviderJson,
    source,
  };
}
