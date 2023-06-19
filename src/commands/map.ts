import type { ProfileDocumentNode, ProviderJson } from '@superfaceai/ast';
import {
  AssertionError,
  assertProviderJson,
  isValidProviderName,
} from '@superfaceai/ast';
import { parseDocumentId, parseProfile, Source } from '@superfaceai/parser';
import { basename } from 'path';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import {
  buildMapPath,
  buildProfilePath,
  buildProviderPath,
} from '../common/file-structure';
import { exists, readFile } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { mapProviderToProfile } from '../logic/map';

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

    // TODO: resuse check from New command
    // Check provider name
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
    // TODO: load old map?
    const map = await mapProviderToProfile(
      {
        providerJson,
        profile: {
          source: profileSource,
          name: profileAst.header.name,
          scope: profileAst.header.scope,
        },
        options: { quiet: flags.quiet },
      },
      { logger }
    );

    const mapPath = buildMapPath(profileId, providerName);

    // TODO: force flag? Ask for confirmation?
    if (await exists(mapPath)) {
      throw userError(`Map ${basename(mapPath)} already exists.`, 1);
    }

    await OutputStream.writeOnce(mapPath, map);

    // TODO: write boilerplate code - profile AST is needed for that
  }
}
