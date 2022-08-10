import { EXTENSIONS } from '@superfaceai/ast';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';

import { UserError } from '../common/error';
import { exists, readFile } from '../common/io';
import { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';

export type MapToCompile = { provider: string; path: string };
export type ProfileToCompile = {
  id: ProfileId;
  maps: MapToCompile[];
  path: string;
};

export async function compile(
  {
    profiles,
    options,
  }: {
    profiles: ProfileToCompile[];
    options?: {
      onlyMap?: boolean;
      onlyProfile?: boolean;
    };
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<void> {
  for (const profile of profiles) {
    //Compile profile
    if (!options?.onlyMap) {
      let profileSourcePath: string, profileAstPath: string;
      //We assume source and build files living next to each other
      if (profile.path.endsWith(EXTENSIONS.profile.source)) {
        profileSourcePath = profile.path;
        profileAstPath = profile.path.replace(
          EXTENSIONS.profile.source,
          EXTENSIONS.profile.build
        );
      } else if (profile.path.endsWith(EXTENSIONS.profile.build)) {
        profileAstPath = profile.path;
        profileSourcePath = profile.path.replace(
          EXTENSIONS.profile.build,
          EXTENSIONS.profile.source
        );
      } else {
        throw userError(
          `Path: "${profile.path}" uses unsupported extension. Please use file with "${EXTENSIONS.profile.source}" extension.`,
          1
        );
      }
      logger.info('compileProfile', profile.id.toString());
      if (!(await exists(profileSourcePath))) {
        throw userError(
          `Path: "${profileSourcePath}" for profile ${profile.id.toString()} does not exist`,
          1
        );
      }
      const source = await readFile(profileSourcePath, { encoding: 'utf-8' });
      const profileAst = parseProfile(new Source(source, profileSourcePath));

      await OutputStream.writeOnce(
        profileAstPath,
        JSON.stringify(profileAst, undefined, 2)
      );
    }
    //Compile maps
    if (!options?.onlyProfile) {
      for (const map of profile.maps) {
        logger.info('compileMap', profile.id.toString(), map.provider);

        let mapSourcePath: string, mapAstPath: string;
        //We assume .suma and .suma.ast.json files living next to each other
        if (map.path.endsWith(EXTENSIONS.map.source)) {
          mapSourcePath = map.path;
          mapAstPath = map.path.replace(
            EXTENSIONS.map.source,
            EXTENSIONS.map.build
          );
        } else if (map.path.endsWith(EXTENSIONS.map.build)) {
          mapAstPath = map.path;
          mapSourcePath = map.path.replace(
            EXTENSIONS.map.build,
            EXTENSIONS.map.source
          );
        } else {
          throw userError(
            `Path: "${map.path}" uses unsupported extension. Please use file with "${EXTENSIONS.map.source}" extension.`,
            1
          );
        }
        if (!(await exists(mapSourcePath))) {
          throw userError(
            `Path: "${mapSourcePath}" for map ${profile.id.toString()}.${
              map.provider
            } does not exist`,
            1
          );
        }
        const source = await readFile(mapSourcePath, { encoding: 'utf-8' });
        const mapAst = parseMap(new Source(source, map.path));

        await OutputStream.writeOnce(
          mapAstPath,
          JSON.stringify(mapAst, undefined, 2)
        );
      }
    }
  }
}
