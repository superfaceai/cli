import { DocumentVersion } from '@superfaceai/parser';
import { SuperJson } from '@superfaceai/sdk';
import { dirname, join as joinPath, relative as relativePath } from 'path';

import { composeVersion, EXTENSIONS, META_FILE } from '../common/document';
import { CreateMode } from '../common/document.interfaces';
import { userError } from '../common/error';
import { LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { TemplateType } from '../templates/common';
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
  template: TemplateType,
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
      ...usecaseNames.map(u => profileTemplate.usecase(template, u)),
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
  template: TemplateType,
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
      ...usecaseNames.map(u => mapTemplate.map(template, u)),
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
  template: TemplateType,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  const filePath = joinPath(basePath, `${name}.provider.json`);
  const created = await OutputStream.writeIfAbsent(
    filePath,
    providerTemplate.provider(template, name),
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
  createMode: CreateMode.PROFILE | CreateMode.MAP | CreateMode.BOTH,
  usecases: string[],
  documentStructure: {
    scope?: string;
    middle: string[];
    version: DocumentVersion;
  },
  template: TemplateType,
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
  const {
    scope,
    middle: [name, provider],
    version,
  } = documentStructure;

  switch (createMode) {
    case CreateMode.PROFILE:
      await createProfile(
        '',
        superJson,
        { scope, name, version },
        usecases,
        template,
        { logCb: options?.logCb }
      );
      break;
    case CreateMode.MAP:
      if (!provider) {
        throw userError(
          'Provider name must be provided when generating a map.',
          2
        );
      }
      await createMap(
        '',
        superJson,
        { scope, name, provider, version },
        usecases,
        template,
        { logCb: options?.logCb }
      );
      await createProviderJson('', superJson, provider, template, {
        logCb: options?.logCb,
      });
      break;
    case CreateMode.BOTH:
      if (!provider) {
        throw userError(
          'Provider name must be provided when generating a map.',
          2
        );
      }
      await createProfile(
        '',
        superJson,
        { scope, name, version },
        usecases,
        template,
        { logCb: options?.logCb }
      );
      await createMap(
        '',
        superJson,
        { scope, name, provider, version },
        usecases,
        template,
        { logCb: options?.logCb }
      );
      await createProviderJson('', superJson, provider, template, {
        logCb: options?.logCb,
      });
      break;
  }

  // write new information to super.json
  await OutputStream.writeOnce(superJson.path, superJson.stringified);
  // options?.logCb?.(
  //   formatShellLog("echo '<updated super.json>' >", [superJson.path])
  // );
}
