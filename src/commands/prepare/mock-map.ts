import { flags as oclifFlags } from '@oclif/command';
import type { ProfileDocumentNode } from '@superfaceai/ast';
import { assertProfileDocumentNode, EXTENSIONS } from '@superfaceai/ast';
import {
  loadSuperJson,
  META_FILE,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import { parseDocumentId, parseProfile, Source } from '@superfaceai/parser';
import { dirname, join as joinPath, resolve as resolvePath } from 'path';

import type { Flags } from '../../common/command.abstract';
import { Command } from '../../common/command.abstract';
import type { UserError } from '../../common/error';
import { readFile } from '../../common/io';
import { OutputStream } from '../../common/output-stream';
import { detectSuperJson } from '../../logic/install';
import { ProfileASTAdapter } from '../../stolen-from-air/profile-adapter';
import { serializeMockMap } from '../../templates/map/prepare-mock-map';

export class MockMap extends Command {
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

    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = this.parse(MockMap);
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
    flags: Flags<typeof MockMap.flags>;
  }): Promise<void> {
    // Check inputs
    const parsedProfileId = parseDocumentId(flags.profileId);
    if (parsedProfileId.kind == 'error') {
      throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
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
    if (normalized.profiles[flags.profileId] === undefined) {
      throw userError(
        `Unable to prepare, profile: "${flags.profileId}" not found in super.json`,
        1
      );
    }

    // Load profile
    let file: string | undefined;
    const profileSettings = normalized.profiles[flags.profileId];

    if (!('file' in profileSettings)) {
      throw userError('Profile is not local', 1);
    }
    file = resolvePath(dirname(superJsonPath), profileSettings.file);

    const ast = await loadProfileAst(file, { userError });

    // TODO: move this to logic

    // TODO: Adapter should probably be separate package
    // Parse profile AST
    const adapter = new ProfileASTAdapter(ast);

    const useCases = adapter.getUseCaseDetailList();

    const mock = serializeMockMap({
      version: {
        major: 1,
        minor: 0,
      },
      name: flags.profileId,
      usecases: useCases.map(d => ({
        name: d.name,
        example: d.successExample?.result,
      })),
    });

    const crtMock = await OutputStream.writeIfAbsent(
      `poc/${flags.profileId}.mock${EXTENSIONS.map.source}`,
      mock,
      { dirs: true }
    );

    console.log('crt', crtMock);
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
    ast = assertProfileDocumentNode(
      JSON.parse(await readFile(path, { encoding: 'utf-8' }))
    );
  } else {
    throw userError('Unknown profile file extension', 1);
  }

  return assertProfileDocumentNode(ast);
}
