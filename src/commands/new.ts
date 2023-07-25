import { basename } from 'path';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { buildProfilePath } from '../common/file-structure';
import { formatPath } from '../common/format';
import { SuperfaceClient } from '../common/http';
import { exists } from '../common/io';
import { OutputStream } from '../common/output-stream';
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
    args: { providerName?: string; prompt?: string };
  }): Promise<void> {
    const ux = UX.create();
    const { providerName, prompt } = args;

    ux.start('Checking input arguments');

    if (providerName === undefined || prompt === undefined) {
      throw userError(
        'Missing provider name or prompt. Please provide them as first and second argument.',
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
        options: { quiet: flags.quiet },
      },
      { userError, ux }
    );

    ux.start('Saving profile for your use case');
    const profilePath = await saveProfile(profile, { userError });

    ux.succeed(
      `New Comlink profile saved to '${formatPath(profilePath)}'.

Create your use case code by running:
superface map ${resolvedProviderJson.providerJson.name} ${
        ProfileId.fromScopeName(profile.scope, profile.name).id
      }`
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
