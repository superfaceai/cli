import { Parser } from '@superfaceai/one-sdk';

import { Logger } from '..';
import { userError } from '../common/error';
import { exists, readFile } from '../common/io';
import { ProfileId } from '../common/profile';

export type MapToCompile = { provider: string; path: string };
export type ProfileToCompile = {
  id: ProfileId;
  maps: MapToCompile[];
  path: string;
};

export async function compile(
  profiles: ProfileToCompile[],
  options?: {
    onlyMap?: boolean;
    onlyProfile?: boolean;
  }
): Promise<void> {
  //Clear cache
  await Parser.clearCache();
  for (const profile of profiles) {
    //Compile profile
    if (!options?.onlyMap) {
      Logger.info('compileProfile', profile.id.toString());
      if (!(await exists(profile.path))) {
        throw userError(
          `❌ Path: "${
            profile.path
          }" for profile ${profile.id.toString()} does not exist`,
          1
        );
      }
      const source = await readFile(profile.path, { encoding: 'utf-8' });
      //TODO: force? log AST/Parser version?
      await Parser.parseProfile(source, profile.path, {
        profileName: profile.id.name,
        scope: profile.id.scope,
      });
    }
    //Compile maps
    if (!options?.onlyProfile) {
      for (const map of profile.maps) {
        Logger.info('compileMap', profile.id.toString(), map.provider);
        if (!(await exists(map.path))) {
          throw userError(
            `❌ Path: "${map.path}" for map ${profile.id.toString()}.${
              map.provider
            } does not exist`,
            1
          );
        }
        const source = await readFile(map.path, { encoding: 'utf-8' });
        //TODO: force? log AST/Parser version?
        await Parser.parseMap(source, map.path, {
          profileName: profile.id.name,
          providerName: map.provider,
          scope: profile.id.scope,
        });
      }
    }
  }
}
