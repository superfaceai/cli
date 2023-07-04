import type { ProfileDocumentNode, ProviderJson } from '@superfaceai/ast';
import { parseDocumentId, parseProfile, Source } from '@superfaceai/parser';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { stringifyError } from '../common/error';
import {
  buildMapPath,
  buildProfilePath,
  buildRunFilePath,
} from '../common/file-structure';
import { exists, readFile } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { UX } from '../common/ux';
import { writeApplicationCode } from '../logic/application-code/application-code';
import { mapProviderToProfile } from '../logic/map';
import { prepareJsProject } from '../logic/project';
import { resolveProviderJson } from './new';
import { ProfileId } from '../common/profile';

export default class Map extends Command {
  // TODO: add description
  public static description =
    'This commands uses Conlink profile and provider definition from `superface` folder and generate JS map and boilerplate code. Created integration is saved in `superface` folder and is ready to be used by our WASM OneSDK. User should check security, integration parameters and input before execution. Created integration can be tested by running `execute` command';

  public static examples = [
    'superface map <provider-name> <optional-profile-scope>/<profile-name>',
  ];

  public static args = [
    {
      name: 'providerName',
      description: 'Name of provider.',
      required: true,
    },
    {
      name: 'profileId',
      description: 'Id of profile, eg: starwars/character-information',
      required: false,
    },
    {
      // TODO: add language support and value validation
      name: 'language',
      description: 'Language which will use generated code. Default is `js`.',
      required: false,
      // Hidden because we support only js for now
      hidden: true,
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
    const ux = UX.create();
    const { providerName, profileId } = args;

    ux.start('Loading profile');
    const profile = await resolveProfileSource(profileId, { userError });

    ux.succeed('Profile loaded');

    ux.start('Loading provider definition');
    const providerJson = await resolveProviderJson(providerName, {
      userError,
    });

    ux.succeed('Provider definition loaded');

    ux.start('Preparing integration code for your use case');
    // TODO: load old map?
    const map = await mapProviderToProfile(
      {
        providerJson,
        profile,
        options: { quiet: flags.quiet },
      },
      { userError, ux }
    );

    ux.succeed('Integration code prepared');

    ux.start('Saving integration code');
    await saveMap({
      map,
      profileName: profile.ast.header.name,
      providerName: providerJson.name,
      profileScope: profile.ast.header.scope,
    });
    ux.succeed('Integration code saved');

    ux.start('Preparing boilerplate code');

    const saved = await saveBoilerplateCode(providerJson, profile.ast, {
      logger,
      userError,
    });
    ux.succeed(
      saved ? 'Boilerplate code prepared.' : 'Boilerplate code already exists.'
    );

    ux.start('Setting up local project');
    // TODO: install dependencies
    await prepareJsProject(undefined, undefined, { logger });

    ux.warn(
      `You need to have Node version 18.0.0 or higher installed to run the integration. Used dependencies:\n"@superfaceai/one-sdk"\n"dotenv"\nYou can install defined dependencies by running \`npm install\` in \`superface\` directory.`
    );

    ux.succeed(
      `Local project set up. You can now install defined dependencies and run \`superface execute ${
        providerJson.name
      } ${ProfileId.fromScopeName(
        profile.scope,
        profile.name
      )}\` to execute your integration.`
    );
  }
}

async function saveBoilerplateCode(
  providerJson: ProviderJson,
  profileAst: ProfileDocumentNode,
  { userError, logger }: { userError: UserError; logger: ILogger }
): Promise<boolean> {
  const path = buildRunFilePath({
    profileName: profileAst.header.name,
    providerName: providerJson.name,
    profileScope: profileAst.header.scope,
    language: 'JS',
  });

  if (await exists(path)) {
    return false;
  }

  const code = await writeApplicationCode(
    {
      providerJson,
      profileAst,
    },
    {
      logger,
      userError,
    }
  );

  await OutputStream.writeOnce(path, code);

  return true;
}

export async function resolveProfileSource(
  profileId: string | undefined,
  { userError }: { userError: UserError }
): Promise<{
  source: string;
  ast: ProfileDocumentNode;
  name: string;
  scope: string | undefined;
}> {
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

  const path = buildProfilePath(
    parsedProfileId.value.scope,
    parsedProfileId.value.middle[0]
  );

  if (!(await exists(path))) {
    throw userError(`Profile ${profileId} does not exist.`, 1);
  }

  const profileSource = await readFile(path, 'utf-8');

  // TODO: this might be problematic - not matchiing parser versions between CLI and Server
  let profileAst: ProfileDocumentNode;
  try {
    profileAst = parseProfile(new Source(profileSource, profileId));
  } catch (e) {
    throw userError(`Invalid profile ${profileId}: ${stringifyError(e)}`, 1);
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
    ast: profileAst,
    name: profileAst.header.name,
    scope: profileAst.header.scope,
  };
}

async function saveMap({
  profileName,
  profileScope,
  providerName,
  map,
}: {
  profileName: string;
  profileScope: string | undefined;
  providerName: string;
  map: string;
}): Promise<void> {
  const mapPath = buildMapPath({
    profileName,
    profileScope,
    providerName,
  });

  await OutputStream.writeOnce(mapPath, map);
}
