import { DocumentVersion } from '@superfaceai/parser';
import { SuperJson } from '@superfaceai/sdk';
import { dirname, join as joinPath, relative as relativePath } from 'path';

import { composeVersion, EXTENSIONS } from '../common/document';
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
