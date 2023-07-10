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
import { SuperfaceClient } from '../common/http';
import { exists, readFile } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { resolveProviderJson } from '../common/provider';
import { UX } from '../common/ux';
import {
  SupportedLanguages,
  writeApplicationCode,
} from '../logic/application-code/application-code';
import { mapProviderToProfile } from '../logic/map';
import { prepareProject } from '../logic/project';

export default class Map extends Command {
  // TODO: add description
  public static description =
    'Creates a new (or updates an existing) Comlink Map that maps the use case to the selected API provider. After Map is available, the integration is ready to be used by our WASM OneSDK. You should check security, integration parameters and input in the created files before execution. The created Comlinks can be tested by running `superface execute` command';

  public static examples = ['superface map resend communication/send-email'];

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
      default: 'js',
      options: Object.values(SupportedLanguages),
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
    args: { providerName?: string; profileId?: string; language?: string };
  }): Promise<void> {
    const ux = UX.create();
    const { providerName, profileId, language } = args;

    const resolvedLanguage = resolveLanguage(language, { userError });

    ux.start('Loading profile');
    const profile = await resolveProfileSource(profileId, { userError });

    ux.succeed('Profile loaded');

    ux.start('Loading provider definition');
    const resolvedProviderJson = await resolveProviderJson(providerName, {
      userError,
      client: SuperfaceClient.getClient(),
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

    ux.succeed('Provider definition loaded');

    ux.start('Preparing integration code for your use case');
    // TODO: load old map?
    const map = await mapProviderToProfile(
      {
        providerJson: resolvedProviderJson.providerJson,
        profile,
        options: { quiet: flags.quiet },
      },
      { userError, ux }
    );

    ux.succeed('Integration code prepared');

    ux.start('Saving integration code');
    const mapPath = await saveMap({
      map,
      profileName: profile.ast.header.name,
      providerName: resolvedProviderJson.providerJson.name,
      profileScope: profile.ast.header.scope,
    });
    ux.succeed(`Integration code saved to ${mapPath}`);

    ux.start(`Preparing boilerplate code for ${resolvedLanguage}`);

    const boilerplate = await saveBoilerplateCode(
      resolvedProviderJson.providerJson,
      profile.ast,
      resolvedLanguage,
      {
        logger,
        userError,
      }
    );
    ux.succeed(
      boilerplate.saved
        ? `Boilerplate code prepared for ${resolvedLanguage} at ${boilerplate.path}`
        : `Boilerplate for ${resolvedLanguage} code already exists at ${boilerplate.path}.`
    );

    ux.start(`Setting up local project in ${resolvedLanguage}`);

    // TODO: install dependencies
    const project = await prepareProject(resolvedLanguage);

    ux.succeed(
      project.saved
        ? `Dependency definition prepared for ${resolvedLanguage} at ${project.path}.`
        : `Dependency definition for ${resolvedLanguage} code already exists at ${project.path}.`
    );
    ux.warn(project.installationGuide);

    ux.succeed(
      `Local project set up. You can now install defined dependencies and run \`superface execute ${
        resolvedProviderJson.providerJson.name
      } ${
        ProfileId.fromScopeName(profile.scope, profile.name).id
      }\` to execute your integration.`
    );
  }
}

export function resolveLanguage(
  language: string | undefined,
  { userError }: { userError: UserError }
): SupportedLanguages {
  if (language === undefined) {
    return SupportedLanguages.JS;
  }
  switch (language) {
    case 'js':
      return SupportedLanguages.JS;
    case 'python':
      return SupportedLanguages.PYTHON;
    default:
      throw userError(
        `Language ${language} is not supported. Supported languages are: ${Object.values(
          SupportedLanguages
        ).join(', ')}`,
        1
      );
  }
}

async function saveBoilerplateCode(
  providerJson: ProviderJson,
  profileAst: ProfileDocumentNode,
  language: SupportedLanguages,
  { userError, logger }: { userError: UserError; logger: ILogger }
): Promise<{ saved: boolean; path: string }> {
  const path = buildRunFilePath({
    profileName: profileAst.header.name,
    providerName: providerJson.name,
    profileScope: profileAst.header.scope,
    language,
  });

  if (await exists(path)) {
    return {
      saved: false,
      path,
    };
  }

  const code = await writeApplicationCode(
    {
      providerJson,
      profileAst,
      language,
    },
    {
      logger,
      userError,
    }
  );

  await OutputStream.writeOnce(path, code);

  return {
    saved: true,
    path,
  };
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
}): Promise<string> {
  const mapPath = buildMapPath({
    profileName,
    profileScope,
    providerName,
  });

  await OutputStream.writeOnce(mapPath, map);

  return mapPath;
}
