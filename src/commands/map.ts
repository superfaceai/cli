import type { ProfileDocumentNode, ProviderJson } from '@superfaceai/ast';
import { parseDocumentId, parseProfile, Source } from '@superfaceai/parser';
import Listr from 'listr';
import { basename } from 'path';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { buildMapPath, buildProfilePath } from '../common/file-structure';
import { exists, readFile } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { mapProviderToProfile } from '../logic/map';
import { resolveProviderJson } from './new';

export default class Map extends Command {
  // TODO: add description
  public static description =
    'This commands uses Conlink profile and provider definition from `superface` folder and generate JS map and boilerplate code. Created integration is saved in `superface` folder and is ready to be used by our WASM SDK. User should check security, integration parameters and input before execution. Created integration can be tested by running `execute` command';

  public static examples = [
    'superface map <provider-name> <optional-profile-scope>.<profile-name>.profile',
  ];

  public static args = [
    {
      name: 'providerName',
      description: 'Name of provider.',
      required: true,
    },
    {
      name: 'profileId',
      description: 'Id of profile, eg: starwars.character-information',
      required: false,
    },
  ];

  public static flags = {
    ...Command.flags,
  };

  public async run(): Promise<void> {
    const { flags, args } = this.parse(Map);
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
    flags: Flags<typeof Map.flags>;
    args: { providerName?: string; profileId?: string };
  }): Promise<void> {
    const { providerName, profileId } = args;

    let map: string;
    let providerJson: ProviderJson;
    let profile: { source: string; name: string; scope: string | undefined };

    const tasks = new Listr<{
      providerName: string | undefined;
      profileId: string | undefined;
      quiet: boolean | undefined;
    }>([
      {
        title: 'Loading Comlink interface',
        task: async ctx => {
          profile = await resolveProfileSource(ctx.profileId, { userError });
        },
      },
      {
        title: 'Loading provider definition',
        task: async ctx => {
          providerJson = await resolveProviderJson(ctx.providerName, {
            userError,
          });
        },
      },
      {
        title: 'Preparing integration code for your use case',
        enabled: () => providerJson !== undefined && profile !== undefined,
        task: async ctx => {
          // TODO: load old map?
          map = await mapProviderToProfile(
            {
              providerJson,
              profile,
              options: { quiet: ctx.quiet },
            },
            { logger }
          );
        },
      },
      {
        title: 'Saving integration code',
        enabled: () => providerJson !== undefined,
        task: async () => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await saveMap(profileId!, providerName!, map, { userError });
        },
      },
    ]);

    await tasks.run({
      providerName,
      profileId,
      quiet: flags.quiet,
    });

    // TODO: write boilerplate code - profile AST is needed for that
  }
}

async function resolveProfileSource(
  profileId: string | undefined,
  { userError }: { userError: UserError }
): Promise<{ source: string; name: string; scope: string | undefined }> {
  // Check profile name
  if (profileId === undefined) {
    throw userError(
      'Missing profile id. Please provide it as first argument.',
      1
    );
  }

  // TODO: move provide Id handling to common?
  const parsedProfileId = parseDocumentId(profileId.replace(/\./, '/'));
  if (parsedProfileId.kind == 'error') {
    throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
  }

  if (!(await exists(buildProfilePath(profileId)))) {
    throw userError(`Profile ${profileId} does not exist.`, 1);
  }

  const profileSource = await readFile(buildProfilePath(profileId), 'utf-8');

  // TODO: this might be problematic - not matchiing parser versions between CLI and Server
  let profileAst: ProfileDocumentNode;
  try {
    profileAst = parseProfile(new Source(profileSource, profileId));
  } catch (e) {
    throw userError(
      `Invalid profile ${profileId}: ${JSON.stringify(e, undefined, 2)}`,
      1
    );
  }

  // TODO: revisit name check
  if (profileAst.header.name !== parsedProfileId.value.middle[0]) {
    throw userError(
      `Profile name in profile file does not match profile name in command.`,
      1
    );
  }

  if (profileAst.header.scope !== parsedProfileId.value.scope) {
    throw userError(
      `Profile scope in profile file does not match profile scope in command.`,
      1
    );
  }

  return {
    source: profileSource,
    name: profileAst.header.name,
    scope: profileAst.header.scope,
  };
}

async function saveMap(
  profileId: string,
  providerName: string,
  map: string,
  { userError }: { userError: UserError }
): Promise<void> {
  const mapPath = buildMapPath(profileId, providerName);

  // TODO: force flag? Ask for confirmation?
  if (await exists(mapPath)) {
    throw userError(`Map ${basename(mapPath)} already exists.`, 1);
  }

  await OutputStream.writeOnce(mapPath, map);
}
