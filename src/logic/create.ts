import { EXTENSIONS } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import {
  MapId,
  MapVersion,
  ProfileId,
  ProfileVersion,
  VersionRange,
} from '@superfaceai/parser';
import { dirname, join as joinPath, relative as relativePath } from 'path';

import { composeVersion, META_FILE } from '../common/document';
import { userError } from '../common/error';
import { formatShellLog, LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import * as mapTemplate from '../templates/map';
import * as profileTemplate from '../templates/profile';
import * as providerTemplate from '../templates/provider';

/**
 * Creates a new profile
 */
export async function createProfile(
  basePath: string,
  profile: ProfileId,
  usecaseNames: string[],
  superJson?: SuperJson,
  fileName?: string,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  //Add extension if missing
  if (fileName && !fileName.endsWith(EXTENSIONS.profile.source)) {
    fileName = fileName + EXTENSIONS.profile.source;
  }
  let filePath =
    fileName || `${profile.withoutVersion}${EXTENSIONS.profile.source}`;

  if (!profile.version) {
    throw userError(
      `Error when creating profile: "${profile.toString()}" - version must be defined`,
      1
    );
  }
  const versionStr = profile.version?.toString();
  filePath = joinPath(basePath, filePath);

  const created = await OutputStream.writeIfAbsent(
    filePath,
    [
      profileTemplate.header(profile.withoutVersion, versionStr),
      ...usecaseNames.map(u => profileTemplate.empty(u)),
    ].join(''),
    { force: options?.force, dirs: true }
  );

  if (created) {
    options?.logCb?.(
      `-> Created ${filePath} (name = "${profile.withoutVersion}", version = "${versionStr}")`
    );
    if (superJson) {
      superJson.mergeProfile(profile.withoutVersion, {
        file: relativePath(dirname(superJson.path), filePath),
      });
    }
  }
}

/**
 * Creates a new map
 */
export async function createMap(
  basePath: string,
  map: MapId,
  usecaseNames: string[],
  superJson?: SuperJson,
  fileName?: string,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  const variantName = map.variant ? `.${map.variant}` : '';
  //Add extension if missing
  if (fileName && !fileName.endsWith(EXTENSIONS.map.source)) {
    fileName = fileName + EXTENSIONS.map.source;
  }

  let filePath =
    fileName ||
    `${map.profile.withoutVersion}.${map.provider}${variantName}${EXTENSIONS.map.source}`;

  const version = composeVersion(map.version, true);

  filePath = joinPath(basePath, filePath);

  const created = await OutputStream.writeIfAbsent(
    filePath,
    [
      mapTemplate.header(
        map.profile.withoutVersion,
        map.provider,
        version,
        map.variant
      ),
      ...usecaseNames.map(u => mapTemplate.empty(u)),
    ].join(''),
    { force: options?.force, dirs: true }
  );

  if (created) {
    options?.logCb?.(
      `-> Created ${filePath} (profile = "${map.profile.withoutVersion}", provider = "${map.provider}")`
    );
    if (superJson) {
      superJson.mergeProfileProvider(map.profile.withoutVersion, map.provider, {
        file: relativePath(dirname(superJson.path), filePath),
      });
    }
  }
}
/**
 * Creates a new provider
 */
export async function createProviderJson(
  basePath: string,
  provider: string,
  superJson?: SuperJson,
  fileName?: string,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  //Add extension if missing
  if (fileName && !fileName.endsWith('.json')) {
    fileName = `${fileName}.json`;
  }

  const filePath = joinPath(basePath, fileName || `${provider}.provider.json`);
  const created = await OutputStream.writeIfAbsent(
    filePath,
    providerTemplate.empty(provider),
    { force: options?.force }
  );

  if (created) {
    options?.logCb?.(`-> Created ${filePath}`);
    if (superJson) {
      superJson.mergeProvider(provider, {
        file: relativePath(dirname(superJson.path), filePath),
      });
    }
  }
}

/**
 * Creates a new document
 */
export async function create(
  create: {
    profile: boolean;
    map: boolean;
    provider: boolean;
    document: {
      scope?: string;
      name?: string;
      providerNames: string[];
      usecases: string[];
      version: VersionRange;
      variant?: string;
    };
    paths: {
      superPath?: string;
      basePath?: string;
    };
    fileNames?: {
      provider?: string;
      map?: string;
      profile?: string;
    };
  },

  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
  }
): Promise<void> {
  //Load super json if we have path
  let superJson: SuperJson | undefined = undefined;
  if (create.paths.superPath) {
    const loadedResult = await SuperJson.load(
      joinPath(create.paths.superPath, META_FILE)
    );
    superJson = loadedResult.match(
      v => v,
      err => {
        options?.warnCb?.(err.formatLong());

        return new SuperJson({});
      }
    );
  }

  const {
    scope,
    name,
    providerNames: providers,
    version,
    variant,
    usecases,
  } = create.document;

  if (create.map) {
    if (providers.length === 0) {
      throw userError(
        'Provider name must be provided when generating a map.',
        2
      );
    }
    if (!name) {
      throw userError(
        'Profile name must be provided when generating a map.',
        2
      );
    }
    if (!version.minor) {
      throw userError(
        'Minor version component must be provided when generating a map.',
        2
      );
    }
    for (const provider of providers) {
      await createMap(
        create.paths.basePath ?? '',
        MapId.fromParameters({
          profile: ProfileId.fromParameters({
            scope,
            name,
            version: ProfileVersion.fromVersionRange(version),
          }),
          version: MapVersion.fromVersionRange(version),
          provider,
          variant,
        }),
        usecases,
        superJson,
        create.fileNames?.map,
        { logCb: options?.logCb }
      );
    }
  }
  if (create.provider) {
    if (providers.length === 0) {
      throw userError(
        'Provider name must be provided when generating a provider.',
        2
      );
    }
    for (const provider of providers) {
      await createProviderJson(
        create.paths.basePath ?? '',
        provider,
        superJson,
        create.fileNames?.provider,
        {
          logCb: options?.logCb,
        }
      );
    }
  }
  if (create.profile) {
    if (!name) {
      throw userError(
        'Profile name must be provided when generating a profile.',
        2
      );
    }
    if (!version.minor) {
      throw userError(
        'Minor version component must be provided when generating a map.',
        2
      );
    }
    if (!version.patch) {
      throw userError(
        'Patch version component must be provided when generating a map.',
        2
      );
    }
    await createProfile(
      create.paths.basePath ?? '',
      ProfileId.fromParameters({
        scope,
        name,
        version: ProfileVersion.fromVersionRange(version),
      }),
      usecases,
      superJson,
      create.fileNames?.profile,
      {
        logCb: options?.logCb,
      }
    );
  }

  // write new information to super.json
  if (superJson) {
    await OutputStream.writeOnce(superJson.path, superJson.stringified);
    options?.logCb?.(
      formatShellLog("echo '<updated super.json>' >", [superJson.path])
    );
  }
}
