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
  superJson: SuperJson,
  id: {
    scope?: string;
    name: string;
    version: DocumentVersion;
  },
  usecaseNames: string[],
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

    superJson.addProfile(profileName, {
      file: relativePath(dirname(superJson.path), filePath),
    });
  }
}

/**
 * Creates a new map
 */
export async function createMap(
  basePath: string,
  superJson: SuperJson,
  id: {
    scope?: string;
    name: string;
    provider: string;
    variant?: string;
    version: DocumentVersion;
  },
  usecaseNames: string[],
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

    superJson.addProfileProvider(profileName, id.provider, {
      file: relativePath(dirname(superJson.path), filePath),
    });
  }
}
/**
 * Creates a new provider
 */
export async function createProviderJson(
  basePath: string,
  superJson: SuperJson,
  name: string,
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

    superJson.addProvider(name, {
      file: relativePath(dirname(superJson.path), filePath),
    });
  }
}

/**
 * Creates a new document
 */
export async function create(
  superPath: string,
  create: {
    createProfile: boolean;
    createMap: boolean;
    createProvider: boolean;
  },
  usecases: string[],
  documentStructure: {
    scope?: string;
    name?: string;
    provider?: string;
    version: DocumentVersion;
    variant?: string;
  },
  options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
  }
): Promise<void> {
  //Load super json
  const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
  const superJson = loadedResult.match(
    v => v,
    err => {
      options?.warnCb?.(err);

      return new SuperJson({});
    }
  );
  const { scope, name, provider, version, variant } = documentStructure;

  if (create.createMap) {
    if (!provider) {
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
    await createMap(
      '',
      superJson,
      { scope, name, provider, variant, version },
      usecases,
      { logCb: options?.logCb }
    );
  }
  if (create.createProvider) {
    if (!provider) {
      throw userError(
        'Provider name must be provided when generating a provider.',
        2
      );
    }
    await createProviderJson('', superJson, provider, {
      logCb: options?.logCb,
    });
  }
  if (create.createProfile) {
    if (!name) {
      throw userError(
        'Profile name must be provided when generating a profile.',
        2
      );
    }
    await createProfile('', superJson, { scope, name, version }, usecases, {
      logCb: options?.logCb,
    });
  }

  // write new information to super.json
  await OutputStream.writeOnce(superJson.path, superJson.stringified);
  options?.logCb?.(
    formatShellLog("echo '<updated super.json>' >", [superJson.path])
  );
}
