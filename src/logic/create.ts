import { EXTENSIONS } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { VersionRange } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import { composeVersion, META_FILE } from '../common/document';
import { userError } from '../common/error';
import { Logger } from '../common/log';
import { messages } from '../common/messages';
import { OutputStream } from '../common/output-stream';
import { resolveSuperfaceRelatedPath } from '../common/path';
import { ProfileId } from '../common/profile';
import * as mapTemplate from '../templates/map';
import * as profileTemplate from '../templates/profile';
import * as providerTemplate from '../templates/provider';

/**
 * Creates a new profile
 */
export async function createProfile(
  basePath: string,
  profile: ProfileId,
  version: VersionRange,
  usecaseNames: string[],
  superJson?: SuperJson,
  fileName?: string,
  options?: {
    force?: boolean;
  }
): Promise<void> {
  //Add extension if missing
  if (fileName && !fileName.endsWith(EXTENSIONS.profile.source)) {
    fileName = fileName + EXTENSIONS.profile.source;
  }
  let filePath = fileName || `${profile.id}${EXTENSIONS.profile.source}`;

  const versionStr = composeVersion(version);
  filePath = joinPath(basePath, filePath);

  const created = await OutputStream.writeIfAbsent(
    filePath,
    [
      profileTemplate.header(profile.id, versionStr),
      ...usecaseNames.map(u => profileTemplate.empty(u)),
    ].join(''),
    { force: options?.force, dirs: true }
  );

  if (created) {
    Logger.success(
      messages.createProfile(profile.withVersion(versionStr), filePath)
    );
    if (superJson) {
      superJson.mergeProfile(profile.id, {
        file: resolveSuperfaceRelatedPath(filePath, superJson),
      });
    }
  }
}

/**
 * Creates a new map
 */
export async function createMap(
  basePath: string,
  id: {
    profile: ProfileId;
    provider: string;
    variant?: string;
    version: VersionRange;
  },
  usecaseNames: string[],
  superJson?: SuperJson,
  fileName?: string,
  options?: {
    force?: boolean;
  }
): Promise<void> {
  const variantName = id.variant ? `.${id.variant}` : '';
  //Add extension if missing
  if (fileName && !fileName.endsWith(EXTENSIONS.map.source)) {
    fileName = fileName + EXTENSIONS.map.source;
  }

  let filePath =
    fileName ||
    `${id.profile.id}.${id.provider}${variantName}${EXTENSIONS.map.source}`;

  const version = composeVersion(id.version, true);

  filePath = joinPath(basePath, filePath);

  const created = await OutputStream.writeIfAbsent(
    filePath,
    [
      mapTemplate.header(id.profile.id, id.provider, version, id.variant),
      ...usecaseNames.map(u => mapTemplate.empty(u)),
    ].join(''),
    { force: options?.force, dirs: true }
  );

  if (created) {
    Logger.success(
      messages.createMap(id.profile.withVersion(version), id.provider, filePath)
    );
    if (superJson) {
      superJson.mergeProfileProvider(id.profile.id, id.provider, {
        file: resolveSuperfaceRelatedPath(filePath, superJson),
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
    Logger.success(messages.createProvider(provider, filePath));
    if (superJson) {
      superJson.mergeProvider(provider, {
        file: resolveSuperfaceRelatedPath(filePath, superJson),
      });
    }
  }
}

/**
 * Creates a new document
 */
export async function create(create: {
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
}): Promise<void> {
  //Load super json if we have path
  let superJson: SuperJson | undefined = undefined;
  if (create.paths.superPath) {
    const loadedResult = await SuperJson.load(
      joinPath(create.paths.superPath, META_FILE)
    );
    superJson = loadedResult.match(
      v => v,
      err => {
        Logger.warn(err.formatLong());

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
    for (const provider of providers) {
      await createMap(
        create.paths.basePath ?? '',
        {
          profile: ProfileId.fromScopeName(scope, name),
          provider,
          variant,
          version,
        },
        usecases,
        superJson,
        create.fileNames?.map
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
        create.fileNames?.provider
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
    await createProfile(
      create.paths.basePath ?? '',
      ProfileId.fromScopeName(scope, name),
      version,
      usecases,
      superJson,
      create.fileNames?.profile
    );
  }

  // write new information to super.json
  if (superJson) {
    await OutputStream.writeOnce(superJson.path, superJson.stringified);
    Logger.info(messages.common.updateSuperJson(superJson.path));
  }
}
