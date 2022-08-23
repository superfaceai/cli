import type { SuperJsonDocument } from '@superfaceai/ast';
import { EXTENSIONS } from '@superfaceai/ast';
import {
  loadSuperJson,
  mergeProfile,
  mergeProfileProvider,
  mergeProvider,
  NodeFileSystem,
} from '@superfaceai/one-sdk';
import type { VersionRange } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import { composeVersion, META_FILE } from '../common/document';
import type { UserError } from '../common/error';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { resolveSuperfaceRelativePath } from '../common/path';
import { ProfileId } from '../common/profile';
import * as mapTemplate from '../templates/map';
import * as profileTemplate from '../templates/profile';
import * as providerTemplate from '../templates/provider';

/**
 * Creates a new profile
 */
export async function createProfile(
  {
    basePath,
    profile,
    version,
    usecaseNames,
    superJson,
    superJsonPath,
    fileName,
    options,
  }: {
    basePath: string;
    profile: ProfileId;
    version: VersionRange;
    usecaseNames: string[];
    superJson?: SuperJsonDocument;
    superJsonPath?: string;
    fileName?: string;
    options?: {
      force?: boolean;
    };
  },
  { logger }: { logger: ILogger }
): Promise<void> {
  // Add extension if missing
  if (fileName !== undefined && !fileName.endsWith(EXTENSIONS.profile.source)) {
    fileName = fileName + EXTENSIONS.profile.source;
  }
  let filePath = fileName ?? `${profile.id}${EXTENSIONS.profile.source}`;

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
    console.log(logger);
    logger.success('createProfile', profile.withVersion(versionStr), filePath);
    if (superJson && superJsonPath !== undefined) {
      mergeProfile(
        superJson,
        profile.id,
        {
          file: resolveSuperfaceRelativePath(superJsonPath, filePath),
        },
        NodeFileSystem
      );
    }
  }
}

/**
 * Creates a new map
 */
export async function createMap(
  {
    basePath,
    id,
    usecaseNames,
    superJson,
    superJsonPath,
    fileName,
    options,
  }: {
    basePath: string;
    id: {
      profile: ProfileId;
      provider: string;
      variant?: string;
      version: VersionRange;
    };
    usecaseNames: string[];
    superJson?: SuperJsonDocument;
    superJsonPath?: string;
    fileName?: string;
    options?: {
      force?: boolean;
    };
  },
  { logger }: { logger: ILogger }
): Promise<void> {
  const variantName = id.variant !== undefined ? `.${id.variant}` : '';
  // Add extension if missing
  if (fileName !== undefined && !fileName.endsWith(EXTENSIONS.map.source)) {
    fileName = fileName + EXTENSIONS.map.source;
  }

  let filePath =
    fileName ??
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
    logger.success(
      'createMap',
      id.profile.withVersion(version),
      id.provider,
      filePath
    );
    if (superJson && superJsonPath !== undefined) {
      mergeProfileProvider(
        superJson,
        id.profile.id,
        id.provider,
        {
          file: resolveSuperfaceRelativePath(superJsonPath, filePath),
        },
        NodeFileSystem
      );
    }
  }
}
/**
 * Creates a new provider
 */
export async function createProviderJson(
  {
    basePath,
    provider,
    superJson,
    superJsonPath,
    fileName,
    options,
  }: {
    basePath: string;
    provider: string;
    superJson?: SuperJsonDocument;
    superJsonPath?: string;
    fileName?: string;
    options?: {
      force?: boolean;
    };
  },
  { logger }: { logger: ILogger }
): Promise<void> {
  // Add extension if missing
  if (fileName !== undefined && !fileName.endsWith('.json')) {
    fileName = `${fileName}.json`;
  }

  const filePath = joinPath(basePath, fileName ?? `${provider}.provider.json`);
  const created = await OutputStream.writeIfAbsent(
    filePath,
    providerTemplate.empty(provider),
    { force: options?.force }
  );

  if (created) {
    logger.success('createProvider', provider, filePath);
    if (superJson && superJsonPath !== undefined) {
      mergeProvider(
        superJson,
        provider,
        {
          file: resolveSuperfaceRelativePath(superJsonPath, filePath),
        },
        NodeFileSystem
      );
    }
  }
}

/**
 * Creates a new document
 */
export async function create(
  {
    profile,
    map,
    provider,
    document,
    paths,
    fileNames,
  }: {
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
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<void> {
  // Load super json if we have path
  let superJson: SuperJsonDocument | undefined = undefined;
  let superJsonPath = undefined;
  if (paths.superPath !== undefined) {
    superJsonPath = joinPath(paths.superPath, META_FILE);
    const loadedResult = await loadSuperJson(superJsonPath, NodeFileSystem);
    superJson = loadedResult.match(
      v => v,
      err => {
        logger.warn('errorMessage', err.formatLong());

        return {};
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
  } = document;

  if (map) {
    if (providers.length === 0) {
      throw userError(
        'Provider name must be provided when generating a map.',
        2
      );
    }
    if (name === undefined) {
      throw userError(
        'Profile name must be provided when generating a map.',
        2
      );
    }
    for (const provider of providers) {
      await createMap(
        {
          basePath: paths.basePath ?? '',
          id: {
            profile: ProfileId.fromScopeName(scope, name),
            provider,
            variant,
            version,
          },
          usecaseNames: usecases,
          superJson,
          superJsonPath,
          fileName: fileNames?.map,
        },
        { logger }
      );
    }
  }
  if (provider) {
    if (providers.length === 0) {
      throw userError(
        'Provider name must be provided when generating a provider.',
        2
      );
    }
    for (const provider of providers) {
      await createProviderJson(
        {
          basePath: paths.basePath ?? '',
          provider,
          superJson,
          superJsonPath,
          fileName: fileNames?.provider,
        },
        { logger }
      );
    }
  }
  if (profile) {
    if (name === undefined) {
      throw userError(
        'Profile name must be provided when generating a profile.',
        2
      );
    }
    await createProfile(
      {
        basePath: paths.basePath ?? '',
        profile: ProfileId.fromScopeName(scope, name),
        version,
        usecaseNames: usecases,
        superJson,
        superJsonPath,
        fileName: fileNames?.profile,
      },
      { logger }
    );
  }

  // write new information to super.json
  if (superJson !== undefined && superJsonPath !== undefined) {
    await OutputStream.writeOnce(
      superJsonPath,
      JSON.stringify(superJson, undefined, 2)
    );
    logger.info('updateSuperJson', superJsonPath);
  }
}
