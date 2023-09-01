import type { ProfileDocumentNode, ProviderJson } from '@superfaceai/ast';
import { parseDocumentId, parseProfile, Source } from '@superfaceai/parser';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { stringifyError } from '../common/error';
import {
  buildMapPath,
  buildProfilePath,
  buildProjectDotenvFilePath,
  buildRunFilePath,
} from '../common/file-structure';
import { formatPath } from '../common/format';
import { fetchSDKToken, SuperfaceClient } from '../common/http';
import { exists, readFile, readFileQuiet } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { resolveProviderJson } from '../common/provider';
import { UX } from '../common/ux';
import { createNewDotenv } from '../logic';
import {
  SupportedLanguages,
  writeApplicationCode,
} from '../logic/application-code/application-code';
import { mapProviderToProfile } from '../logic/map';
import { prepareProject } from '../logic/project';

type Status = {
  filesCreated: string[];
  dotenv?: {
    path: string;
    newVars: string[];
  };
  execution?: {
    languageDependency: string;
    dependencyInstallCommand: string;
    executeCommand: string;
  };
};

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
      name: 'language',
      description:
        'Language of the generated application code. Default is `js`',
      required: false,
      options: Object.values(SupportedLanguages),
      default: SupportedLanguages.JS,
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

    if (providerName === undefined || profileId === undefined) {
      throw userError(
        'Missing provider name or profile ID. Usage: `superface map PROVIDERNAME [PROFILEID]`',
        1
      );
    }

    const resolvedLanguage = resolveLanguage(language, { userError });
    const hasExplicitLanguageSelect = language !== undefined;

    ux.start('Loading profile');
    const profile = await resolveProfileSource(profileId, { userError });

    ux.start('Loading provider definition');
    const resolvedProviderJson = await resolveProviderJson(providerName, {
      userError,
      client: SuperfaceClient.getClient(),
    });

    const status: Status = {
      filesCreated: [],
    };

    ux.start('Preparing integration code for your use case');
    // TODO: load old map?
    const map = await mapProviderToProfile(
      {
        providerJson: resolvedProviderJson.providerJson,
        profile: profile.source,
        options: { quiet: flags.quiet },
      },
      { userError, ux }
    );
    const mapPath = await saveMap({
      map,
      profileName: profile.ast.header.name,
      providerName: resolvedProviderJson.providerJson.name,
      profileScope: profile.ast.header.scope,
    });

    status.filesCreated.push(mapPath);

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
    if (boilerplate.saved) {
      status.filesCreated.push(boilerplate.path);
    }

    const dotenv = await saveDotenv(resolvedProviderJson.providerJson);

    if (dotenv.newEnvVariables.length > 0) {
      status.dotenv = {
        path: dotenv.dotenvPath,
        newVars: dotenv.newEnvVariables,
      };
    }

    ux.start(`Setting up local project in ${resolvedLanguage}`);

    // TODO: install dependencies
    const project = await prepareProject(resolvedLanguage);

    const executeCommand = makeExecuteCommand({
      providerName: resolvedProviderJson.providerJson.name,
      profileScope: profile.scope,
      profileName: profile.name,
      resolvedLanguage,
      hasExplicitLanguageSelect,
    });

    status.execution = {
      languageDependency: project.languageDependency,
      dependencyInstallCommand: project.dependencyInstallCommand,
      executeCommand: executeCommand,
    };

    ux.succeed(makeMessage(status));
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

  await OutputStream.writeOnce(path, code.code);

  return {
    saved: true,
    path,
  };
}

async function saveDotenv(
  providerJson: ProviderJson
): Promise<{ dotenvPath: string; newEnvVariables: string[] }> {
  const dotenvPath = buildProjectDotenvFilePath();

  const { token } = await fetchSDKToken();
  const existingDotenv = await readFileQuiet(dotenvPath);

  const newDotenv = createNewDotenv({
    previousDotenv: existingDotenv,
    providerName: providerJson.name,
    parameters: providerJson.parameters,
    security: providerJson.securitySchemes,
    token,
  });

  if (newDotenv.content) {
    await OutputStream.writeOnce(dotenvPath, newDotenv.content);
  }

  return {
    dotenvPath,
    newEnvVariables: newDotenv.newEmptyEnvVariables,
  };
}

export async function resolveProfileSource(
  profileId: string,
  { userError }: { userError: UserError }
): Promise<{
  source: string;
  ast: ProfileDocumentNode;
  name: string;
  scope: string | undefined;
}> {
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

function makeExecuteCommand({
  providerName,
  profileScope,
  profileName,
  resolvedLanguage,
  hasExplicitLanguageSelect,
}: {
  providerName: string;
  profileScope: string | undefined;
  profileName: string;
  resolvedLanguage: SupportedLanguages;
  hasExplicitLanguageSelect: boolean;
}): string {
  const sfExecute = `superface execute ${providerName} ${
    ProfileId.fromScopeName(profileScope, profileName).id
  }`;

  return hasExplicitLanguageSelect
    ? `${sfExecute} ${resolvedLanguage}`
    : sfExecute;
}

function makeMessage(status: Status): string {
  let message = `📡 Comlink established!`;

  if (status.filesCreated.length > 0) {
    message += `

Files created:
${status.filesCreated.map(file => `- ${formatPath(file)}`).join('\n')}`;
  }

  if (status.dotenv) {
    message += `

Set the following environment variables in '${formatPath(status.dotenv.path)}':
${status.dotenv.newVars.map(env => `- $${env}`).join('\n')}`;
  }

  if (status.execution) {
    message += `

✨ Test the created integration (${status.execution.languageDependency}):
{bold cd superface && ${status.execution.dependencyInstallCommand}
${status.execution.executeCommand}}`;
  }

  return message;
}
