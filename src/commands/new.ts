import { flags as oclifFlags } from '@oclif/command';
import { basename } from 'path';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { buildProfilePath } from '../common/file-structure';
import { formatPath } from '../common/format';
import { SuperfaceClient } from '../common/http';
import { exists } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { DEFAULT_POLLING_TIMEOUT_SECONDS } from '../common/polling';
import { ProfileId } from '../common/profile';
import { resolveProviderJson } from '../common/provider';
import { UX } from '../common/ux';
import { newProfile } from '../logic/new';

const MAX_PROMPT_LENGTH = 200;

export default class New extends Command {
  // TODO: add description
  public static description =
    'Creates new Comlink Profile for your use case based on the selected API. Comlink Profile defines the interface of the API integration. Use name of API provider as the first argument followed by the description of your use case. You need to run `superface prepare` command before running this command.';

  public static examples = [
    'superface new swapi "retrieve character\'s homeworld by their name"',
    'superface new swapi "retrieve character\'s homeworld by their name" swapi/character-information',

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
      description: 'Short description of your use case in natural language.',
      required: true,
    },
    {
      name: 'profileId',
      description:
        'Optional ID of the new profile, e.g. starwars/character-information. If not provided, profile ID will be inferred from the prompt.',
      required: false,
    },
  ];

  public static flags = {
    ...Command.flags,
    timeout: oclifFlags.integer({
      char: 't',
      required: false,
      description: `Opration timeout in seconds. If not provided, it will be set to ${DEFAULT_POLLING_TIMEOUT_SECONDS} seconds. Usefull for large APIs.`,
      default: DEFAULT_POLLING_TIMEOUT_SECONDS,
    }),
  };

  public async run(): Promise<void> {
    const { flags, args } = this.parse(New);
    await super.initialize(flags);
    await this.execute({
      userError: this.userError,
      flags,
      args,
    });
  }

  public async execute({
    userError,
    flags,
    args,
  }: {
    userError: UserError;
    flags: Flags<typeof New.flags>;
    args: { providerName?: string; prompt?: string; profileId?: string };
  }): Promise<void> {
    const ux = UX.create();
    const { providerName, prompt, profileId } = args;

    const customProfileId =
      profileId !== undefined
        ? ProfileId.fromId(profileId, { userError })
        : undefined;

    ux.start('Checking input arguments');

    if (providerName === undefined || prompt === undefined) {
      throw userError(
        'Missing provider name or prompt. Usage: `superface new PROVIDERNAME [PROMPT]`',
        1
      );
    }

    checkPrompt(prompt, { userError });

    const resolvedProviderJson = await resolveProviderJson(providerName, {
      userError,
      client: SuperfaceClient.getClient(),
    });

    ux.start('Creating profile for your use case');
    // TODO: should take also user error?
    const profile = await newProfile(
      {
        providerJson: resolvedProviderJson.providerJson,
        prompt: prompt,
        profileName: customProfileId?.name,
        profileScope: customProfileId?.scope,
        options: { quiet: flags.quiet, timeout: flags.timeout },
      },
      { userError, ux }
    );

    ux.start('Saving profile for your use case');
    const profilePath = await saveProfile(profile, { userError });

    ux.succeed(
      `New Comlink profile saved to '${formatPath(profilePath)}'.

Create your use case code by running:
{bold superface map ${resolvedProviderJson.providerJson.name} ${
        ProfileId.fromScopeName(profile.scope, profile.name).id
      }}`
    );
  }
}

async function saveProfile(
  { source, scope, name }: { source: string; scope?: string; name: string },
  { userError }: { userError: UserError }
): Promise<string> {
  const profilePath = buildProfilePath(scope, name);

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
