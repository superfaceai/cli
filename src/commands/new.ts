import type { ProviderJson } from '@superfaceai/ast';
import {
  AssertionError,
  assertProviderJson,
  isValidProviderName,
} from '@superfaceai/ast';
import { basename } from 'path';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { buildProfilePath, buildProviderPath } from '../common/file-structure';
import { exists, readFile } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { UX } from '../common/ux';
import { newProfile } from '../logic/new';

const MAX_PROMPT_LENGTH = 200;

export default class New extends Command {
  // TODO: add description
  public static description =
    'Generates Comlink profile from prepared API documentation. Comlink profile defines interface of API integration. Use name of provider as first argument and description of your use case as second argument';

  public static examples = [
    'superface new swapi "retrieve character\'s homeworld by their name',
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

    ux.succeed('Input arguments checked');

    ux.start('Loading provider definition');
    const providerJson = await resolveProviderJson(providerName, {
      userError,
    });

    ux.succeed('Provider definition loaded');

    ux.start('Creating profile for your use case');
    // TODO: should take also user error?
    const profile = await newProfile(
      {
        providerJson,
        prompt: prompt,
        options: { quiet: flags.quiet },
      },
      { logger, userError, ux }
    );
    ux.succeed('Profile created');

    ux.start('Saving profile for your use case');
    await saveProfile(profile, { logger, userError });

    ux.succeed(
      `Profile saved. You can use it to generate integration code for your use case by running 'superface map  ${
        providerJson.name
      } ${profile.scope !== undefined ? `${profile.scope}.` : ''}${
        profile.name
      }'`
    );
  }
}

async function saveProfile(
  { source, scope, name }: { source: string; scope?: string; name: string },
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<void> {
  const profilePath = buildProfilePath(
    `${scope !== undefined ? scope + '.' : ''}${name}`
  );

  logger.info('saveProfile', profilePath);

  // TODO: force flag? or overwrite by default?
  if (await exists(profilePath)) {
    throw userError(`Profile ${basename(profilePath)} already exists.`, 1);
  }

  await OutputStream.writeOnce(profilePath, source);
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

export async function resolveProviderJson(
  providerName: string | undefined,
  { userError }: { userError: UserError }
): Promise<ProviderJson> {
  if (providerName === undefined) {
    throw userError(
      'Missing provider name. Please provide it as first argument.',
      1
    );
  }

  if (!isValidProviderName(providerName)) {
    throw userError('Invalid provider name', 1);
  }

  if (!(await exists(buildProviderPath(providerName)))) {
    throw userError(
      `Provider ${providerName} does not exist. Make sure to run "sf prepare" before running this command.`,
      1
    );
  }

  const providerJsonFile = await readFile(
    buildProviderPath(providerName),
    'utf-8'
  );
  let providerJson: ProviderJson;
  try {
    providerJson = JSON.parse(providerJsonFile) as ProviderJson;
  } catch (e) {
    throw userError(`Invalid provider.json file.`, 1);
  }

  try {
    assertProviderJson(providerJson);
  } catch (e) {
    if (e instanceof AssertionError) {
      throw userError(`Invalid provider.json file. ${e.message}`, 1);
    }
    throw userError(`Invalid provider.json file.`, 1);
  }

  if (providerName !== providerJson.name) {
    throw userError(
      `Provider name in provider.json file does not match provider name in command.`,
      1
    );
  }

  return providerJson;
}
