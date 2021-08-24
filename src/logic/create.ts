import { SuperJson } from '@superfaceai/one-sdk';
import { DocumentVersion } from '@superfaceai/parser';
import { dirname, join as joinPath, relative as relativePath } from 'path';

import { composeVersion, EXTENSIONS, META_FILE } from '../common/document';
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
  id: {
    scope?: string;
    name: string;
    version: DocumentVersion;
  },
  usecaseNames: string[],
  superJson?: SuperJson,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  let profileName = id.name;
  let filePath = `${profileName}${EXTENSIONS.profile.source}`;
  const version = composeVersion(id.version);

  if (id.scope !== undefined) {
    profileName = `${id.scope}/${profileName}`;
    filePath = joinPath(id.scope, filePath);
  }
  filePath = joinPath(basePath, filePath);

  const created = await OutputStream.writeIfAbsent(
    filePath,
    [
      profileTemplate.header(profileName, version),
      ...usecaseNames.map(u => profileTemplate.empty(u)),
    ].join(''),
    { force: options?.force, dirs: true }
  );

  if (created) {
    options?.logCb?.(
      `-> Created ${filePath} (name = "${profileName}", version = "${version}")`
    );
    if (superJson) {
      superJson.mergeProfile(profileName, {
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
  id: {
    scope?: string;
    name: string;
    provider: string;
    variant?: string;
    version: DocumentVersion;
  },
  usecaseNames: string[],
  superJson?: SuperJson,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  let profileName = id.name;
  const variantName = id.variant ? `.${id.variant}` : '';

  let filePath = `${profileName}.${id.provider}${variantName}${EXTENSIONS.map.source}`;
  const version = composeVersion(id.version, true);

  if (id.scope !== undefined) {
    profileName = `${id.scope}/${profileName}`;
    filePath = joinPath(id.scope, filePath);
  }
  filePath = joinPath(basePath, filePath);

  const created = await OutputStream.writeIfAbsent(
    filePath,
    [
      mapTemplate.header(profileName, id.provider, version, id.variant),
      ...usecaseNames.map(u => mapTemplate.empty(u)),
    ].join(''),
    { force: options?.force, dirs: true }
  );

  if (created) {
    options?.logCb?.(
      `-> Created ${filePath} (profile = "${profileName}@${version}", provider = "${id.provider}")`
    );
    if (superJson) {
      superJson.mergeProfileProvider(profileName, id.provider, {
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
  name: string,
  superJson?: SuperJson,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  const filePath = joinPath(basePath, `${name}.provider.json`);
  const created = await OutputStream.writeIfAbsent(
    filePath,
    providerTemplate.empty(name),
    { force: options?.force }
  );

  if (created) {
    options?.logCb?.(`-> Created ${name}.provider.json`);
    if (superJson) {
      superJson.mergeProvider(name, {
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
    createProfile: boolean;
    createMap: boolean;
    createProvider: boolean;
  },
  usecases: string[],
  documentStructure: {
    scope?: string;
    name?: string;
    providerNames: string[];
    version: DocumentVersion;
    variant?: string;
  },
  superPath?: string,
  basePath?: string,
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
  }
): Promise<void> {
  //Load super json if we have path
  let superJson: SuperJson | undefined = undefined;
  if (superPath) {
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
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
  } = documentStructure;

  if (create.createMap) {
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
        basePath ?? '',
        { scope, name, provider, variant, version },
        usecases,
        superJson,
        { logCb: options?.logCb }
      );
    }
  }
  if (create.createProvider) {
    if (providers.length === 0) {
      throw userError(
        'Provider name must be provided when generating a provider.',
        2
      );
    }
    for (const provider of providers) {
      await createProviderJson(basePath ?? '', provider, superJson, {
        logCb: options?.logCb,
      });
    }
  }
  if (create.createProfile) {
    if (!name) {
      throw userError(
        'Profile name must be provided when generating a profile.',
        2
      );
    }
    await createProfile(
      basePath ?? '',
      { scope, name, version },
      usecases,
      superJson,
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
