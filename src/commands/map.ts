import { flags as oclifFlags } from '@oclif/command';
import { Command } from '../common/command.abstract';
import type { Flags } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { parseDocumentId } from '@superfaceai/parser';
import {
  assertProfileDocumentNode,
  assertProviderJson,
  EXTENSIONS,
  isValidProviderName,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import {
  loadSuperJson,
  META_FILE,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import { dirname, join as joinPath, resolve as resolvePath } from 'path';
import { detectSuperJson } from '../logic/install';
import { parseProfile, Source } from '@superfaceai/parser';
import { readFile } from '../common/io';
import { ProfileASTAdapter } from '../stolen-from-air/profile-adapter';
import { inspect } from 'util';
import { serializeMap } from '../templates/map/prepare-map';
import { OutputStream } from '../common/output-stream';

export default class Map extends Command {
  public static strict = true;

  public static description =
    'Creates empty map, profile or/and provider on a local filesystem.';

  public static flags = {
    ...Command.flags,
    // Inputs
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope](optional)/[name]',
      required: true,
    }),
    providerName: oclifFlags.string({
      description:
        'Names of providers. This argument is used to create maps and/or providers',
      required: true,
    }),
    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = this.parse(Map);
    await super.initialize(flags);
    await this.execute({
      // logger: this.logger,
      userError: this.userError,
      flags,
    });
  }

  public async execute({
    // logger,
    userError,
    flags,
  }: {
    // logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Map.flags>;
  }): Promise<void> {
    // Check inputs
    if (flags.profileId !== undefined) {
      const parsedProfileId = parseDocumentId(flags.profileId);
      if (parsedProfileId.kind == 'error') {
        throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
      }
    }

    if (flags.providerName !== undefined) {
      if (!isValidProviderName(flags.providerName)) {
        throw userError(`Invalid provider name: "${flags.providerName}"`, 1);
      }
      if (flags.profileId == undefined) {
        throw userError(
          '--profileId must be specified when using --providerName',
          1
        );
      }
    }

    if (
      flags.scan !== undefined &&
      (typeof flags.scan !== 'number' || flags.scan > 5)
    ) {
      throw userError(
        '--scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }
    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (superPath === undefined) {
      throw userError('Unable to lint, super.json not found', 1);
    }
    // Load super json
    const superJsonPath = joinPath(superPath, META_FILE);
    const loadedResult = await loadSuperJson(superJsonPath, NodeFileSystem);
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err.formatShort()}`, 1);
      }
    );
    const normalized = normalizeSuperJsonDocument(superJson);

    // Check super.json
    if (flags.profileId !== undefined) {
      if (normalized.profiles[flags.profileId] === undefined) {
        throw userError(
          `Unable to prepare, profile: "${flags.profileId}" not found in super.json`,
          1
        );
      }
    }

    if (flags.providerName !== undefined) {
      if (normalized.providers[flags.providerName] === undefined) {
        throw userError(
          `Unable to prepare, provider: "${flags.providerName}" not found in super.json`,
          1
        );
      }
    }

    // Load profile
    let file: string | undefined;
    const profileSettings = normalized.profiles[flags.profileId];

    if (!('file' in profileSettings)) {
      throw userError('Profile is not local', 1);
    }
    file = resolvePath(dirname(superJsonPath), profileSettings.file);

    console.log('file', file);

    const ast = await loadProfileAst(file, { userError });

    console.log('AST', ast);

    // Load provider
    const providerSettings = normalized.providers[flags.providerName];
    if (!('file' in providerSettings) || providerSettings.file === undefined) {
      throw userError('Provider is not local', 1);
    }
    file = resolvePath(dirname(superJsonPath), providerSettings.file);
    const provider = assertProviderJson(
      JSON.parse(await readFile(file, { encoding: 'utf-8' }))
    );

    // Adapter should probably be separate package
    const adapter = new ProfileASTAdapter(ast);

    const details = adapter.getUseCaseDetailList();

    console.log('details', inspect(details, true, 20));

    let defaultSecurityId: string | undefined = undefined;

    if (provider.securitySchemes !== undefined) {
      if (provider.securitySchemes.length === 0) {
        defaultSecurityId = provider.securitySchemes[0].id;
      }
    }
    const prepared = serializeMap({
      version: {
        major: 1,
        minor: 0,
      },
      name: flags.profileId,
      provider: provider.name,
      defaultSecurityId,
      details,
    });

    console.log('prepared', prepared);

    const crt = await OutputStream.writeIfAbsent(
      `poc/${flags.profileId}.${flags.providerName}${EXTENSIONS.map.source}`,
      prepared,
      { dirs: true }
    );

    console.log('crt', crt);
  }
}

async function loadProfileAst(
  path: string,
  {
    userError,
  }: {
    userError: UserError;
  }
): Promise<ProfileDocumentNode> {
  const source = await readFile(path, { encoding: 'utf-8' });

  let ast: ProfileDocumentNode;
  if (path.endsWith(EXTENSIONS.profile.source)) {
    ast = parseProfile(new Source(source, path));
  } else if (path.endsWith(EXTENSIONS.profile.build)) {
    ast = JSON.parse(await readFile(path, { encoding: 'utf-8' }));
  } else {
    throw userError('Unknown profile file extension', 1);
  }

  return assertProfileDocumentNode(ast);
}
