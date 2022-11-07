import type { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import { EXTENSIONS } from '@superfaceai/ast';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';

import type { UserError } from '../common/error';
import { exists, readFile } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import type { ProfileId } from '../common/profile';

export type FileToCompile =
  | { kind: 'map'; profileId: ProfileId; provider: string; path: string }
  | { kind: 'profile'; profileId: ProfileId; path: string };

export async function compile(
  files: FileToCompile[],
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<void> {
  for (const file of files) {
    let sourcePath: string, astPath: string;
    // We assume source and build files living next to each other
    if (file.path.endsWith(EXTENSIONS[file.kind].source)) {
      sourcePath = file.path;
      astPath = file.path.replace(
        EXTENSIONS[file.kind].source,
        EXTENSIONS[file.kind].build
      );
    } else if (file.path.endsWith(EXTENSIONS[file.kind].build)) {
      astPath = file.path;
      sourcePath = file.path.replace(
        EXTENSIONS[file.kind].build,
        EXTENSIONS[file.kind].source
      );
    } else {
      throw userError(
        `Path: "${
          file.path
        }" uses unsupported extension. Please use file with "${
          EXTENSIONS[file.kind].source
        }" extension.`,
        1
      );
    }

    if (file.kind === 'profile') {
      logger.info('compileProfile', file.profileId.id.toString());
    } else {
      logger.info('compileMap', file.profileId.id.toString(), file.provider);
    }
    if (!(await exists(sourcePath))) {
      if (file.kind === 'profile') {
        throw userError(
          `Path: "${sourcePath}" for profile ${file.profileId.id.toString()} does not exist`,
          1
        );
      } else {
        throw userError(
          `Path: "${sourcePath}" for map ${file.profileId.id.toString()}.${
            file.provider
          } does not exist`,
          1
        );
      }
    }
    const source = await readFile(sourcePath, { encoding: 'utf-8' });
    let ast: ProfileDocumentNode | MapDocumentNode | undefined;
    try {
      ast =
        file.kind === 'map'
          ? parseMap(new Source(source, sourcePath))
          : parseProfile(new Source(source, sourcePath));
    } catch (error) {
      if (file.kind === 'profile') {
        logger.error(
          'profileCompilationFailed',
          file.profileId.id.toString(),
          sourcePath,
          error
        );
      } else {
        logger.error(
          'mapCompilationFailed',
          file.profileId.id.toString(),
          file.provider,
          sourcePath,
          error
        );
      }
    }

    if (ast !== undefined) {
      await OutputStream.writeOnce(astPath, JSON.stringify(ast, undefined, 2));
    }
  }
}
