import {
  assertMapDocumentNode,
  EXTENSIONS,
  isMapDocumentNode,
  isProfileDocumentNode,
  MapDocumentNode,
  ProfileDocumentNode,
  VERSION as AstVersion,
} from '@superfaceai/ast';
import {
  PARSED_AST_VERSION,
  parseMap,
  parseProfile,
  Source,
} from '@superfaceai/parser';
import { join as joinPath } from 'path';

import { exists, isAccessible, mkdir, readdir, readFile, rimraf } from './io';
import { OutputStream } from './output-stream';

export class Parser {
  private static mapCache: Record<string, MapDocumentNode> = {};
  private static profileCache: Record<string, ProfileDocumentNode> = {};

  public static async parseMap(
    input: string,
    fileName: string,
    info: {
      profileName: string;
      providerName: string;
      scope?: string;
    },
    cachePath: string = joinPath(process.cwd(), 'superface', '.cache')
  ): Promise<MapDocumentNode> {
    const sourceChecksum = new Source(input, fileName).checksum();
    const profileCachePath = joinPath(
      cachePath,
      ...[...(info.scope !== undefined ? [info.scope] : []), info.profileName]
    );
    const path = joinPath(
      profileCachePath,
      `${info.providerName}${EXTENSIONS.map.build}`
    );

    // If we have valid map in memory cache, just return it
    if (
      this.mapCache[path] !== undefined &&
      isMapDocumentNode(this.mapCache[path]) &&
      this.mapCache[path].astMetadata.sourceChecksum === sourceChecksum
    ) {
      return this.mapCache[path];
    }

    // If we already have valid AST in cache file, load it
    let parsedMap = await Parser.loadCached(
      path,
      isMapDocumentNode,
      this.mapCache,
      new Source(input, fileName).checksum()
    );
    if (parsedMap !== undefined) {
      return parsedMap;
    }

    // If not, delete old parsed maps
    await Parser.clearFileCache(path);

    // And write parsed file to cache
    parsedMap = parseMap(new Source(input, fileName));
    try {
      assertMapDocumentNode(parsedMap);
    } catch (e) {
      console.log(e);
    }
    if (!isMapDocumentNode(parsedMap)) {
      const parserAstVersion = `${PARSED_AST_VERSION.major}.${
        PARSED_AST_VERSION.minor
      }.${PARSED_AST_VERSION.patch}${
        PARSED_AST_VERSION.label !== undefined
          ? '-' + PARSED_AST_VERSION.label
          : ''
      }`;
      throw new Error(
        `Parsed map is not valid. This can be caused by not matching versions of package @superfaceai/ast.\nVersion of AST in Parser used to parse map: ${parserAstVersion}.\nVersion of AST used to validation: ${AstVersion}`
      );
    }
    await Parser.writeFileCache(
      parsedMap,
      this.mapCache,
      profileCachePath,
      path
    );

    return parsedMap;
  }

  public static async parseProfile(
    input: string,
    fileName: string,
    info: {
      profileName: string;
      scope?: string;
    },
    cachePath: string = joinPath(process.cwd(), 'superface', '.cache')
  ): Promise<ProfileDocumentNode> {
    const sourceChecksum = new Source(input, fileName).checksum();
    const scopeCachePath = joinPath(
      cachePath,
      ...[...(info.scope !== undefined ? [info.scope] : [])]
    );
    const path = joinPath(
      scopeCachePath,
      `${info.profileName}${EXTENSIONS.profile.build}`
    );

    // If we have it in memory cache, just return it
    if (
      this.profileCache[path] !== undefined &&
      isProfileDocumentNode(this.profileCache[path]) &&
      this.profileCache[path].astMetadata.sourceChecksum === sourceChecksum
    ) {
      return this.profileCache[path];
    }

    // If we already have valid AST in cache file, load it
    let parsedProfile = await Parser.loadCached(
      path,
      isProfileDocumentNode,
      this.profileCache,
      sourceChecksum
    );
    // If we have cached AST, we can use it.
    if (parsedProfile !== undefined) {
      return parsedProfile;
    }

    // If not, delete old parsed profiles
    await Parser.clearFileCache(path);

    // And write parsed file to cache
    parsedProfile = parseProfile(new Source(input, fileName));
    if (!isProfileDocumentNode(parsedProfile)) {
      const parserAstVersion = `${PARSED_AST_VERSION.major}.${
        PARSED_AST_VERSION.minor
      }.${PARSED_AST_VERSION.patch}${
        PARSED_AST_VERSION.label !== undefined
          ? '-' + PARSED_AST_VERSION.label
          : ''
      }`;
      throw new Error(
        `Parsed profile is not valid. This can be caused by not matching versions of package @superfaceai/ast.\nVersion of AST in Parser used to parse profile: ${parserAstVersion}.\nVersion of AST used to validation: ${AstVersion}`
      );
    }
    await this.writeFileCache(
      parsedProfile,
      this.profileCache,
      scopeCachePath,
      path
    );

    return parsedProfile;
  }

  public static async clearCache(
    cachePath: string = joinPath(process.cwd(), 'superface', '.cache')
  ): Promise<void> {
    this.mapCache = {};
    this.profileCache = {};

    if (await isAccessible(cachePath)) {
      await rimraf(cachePath);
    }
  }

  private static async loadCached<
    T extends MapDocumentNode | ProfileDocumentNode
  >(
    path: string,
    guard: (node: unknown) => node is T,
    cache: Record<string, T>,
    sourceHash: string
  ): Promise<T | undefined> {
    if (!(await exists(path))) {
      return undefined;
    }
    const loaded = JSON.parse(
      await readFile(path, { encoding: 'utf8' })
    ) as unknown;
    // Check if valid type
    if (!guard(loaded)) {
      return undefined;
    }
    // Check if checksum match
    if (loaded.astMetadata.sourceChecksum !== sourceHash) {
      return undefined;
    }
    cache[path] = loaded;

    return loaded;
  }

  private static async clearFileCache(path: string): Promise<void> {
    try {
      const files = await readdir(path);
      for (const file of files) {
        await rimraf(joinPath(path, file));
      }
    } catch (e) {
      void e;
    }
  }

  private static async writeFileCache<
    T extends MapDocumentNode | ProfileDocumentNode
  >(
    node: T,
    cache: Record<string, T>,
    cachePath: string,
    filePath: string
  ): Promise<void> {
    cache[filePath] = node;
    try {
      await mkdir(cachePath, { recursive: true });
      await OutputStream.writeOnce(
        filePath,
        JSON.stringify(node, undefined, 2)
      );
    } catch (e) {
      // Fail silently as the cache is strictly speaking unnecessary
      void e;
    }
  }
}
