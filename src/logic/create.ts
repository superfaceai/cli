import { DocumentVersion } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import { composeVersion, EXTENSIONS } from '../common/document';
import { OutputStream } from '../common/io';
import * as mapTemplate from '../templates/map';
import * as profileTemplate from '../templates/profile';
import { defaultProvider } from '../templates/provider';

type LogCallback = (message: string) => void;

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
  template: profileTemplate.UsecaseTemplateType,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  let documentName = id.name;
  let filePath = `${documentName}${EXTENSIONS.profile.source}`;
  const version = composeVersion(id.version);

  if (id.scope !== undefined) {
    documentName = `${id.scope}/${documentName}`;
    filePath = joinPath(id.scope, filePath);
  }
  filePath = joinPath(basePath, filePath);

  const created = await OutputStream.writeIfAbsent(
    filePath,
    [
      profileTemplate.header(documentName, version),
      ...usecaseNames.map(u => profileTemplate.usecase(template, u)),
    ].join(''),
    { force: options?.force, dirs: true }
  );

  if (created) {
    options?.logCb?.(
      `-> Created ${filePath} (name = "${documentName}", version = "${version}")`
    );
  }
}

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
  template: mapTemplate.MapTemplateType,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  let documentName = id.name;
  const variantName = id.variant ? `.${id.variant}` : '';
  let filePath = `${documentName}.${id.provider}${variantName}${EXTENSIONS.map.source}`;
  const version = composeVersion(id.version, true);

  if (id.scope !== undefined) {
    documentName = `${id.scope}/${documentName}`;
    filePath = joinPath(id.scope, filePath);
  }
  filePath = joinPath(basePath, filePath);

  const created = await OutputStream.writeIfAbsent(
    filePath,
    [
      mapTemplate.header(documentName, id.provider, version, id.variant),
      ...usecaseNames.map(u => mapTemplate.map(template, u)),
    ].join(''),
    { force: options?.force, dirs: true }
  );

  if (created) {
    options?.logCb?.(
      `-> Created ${filePath} (profile = "${documentName}@${version}", provider = "${id.provider}")`
    );
  }
}

export async function createProviderJson(
  basePath: string,
  name: string,
  options?: {
    force?: boolean;
    logCb?: LogCallback;
  }
): Promise<void> {
  const created = await OutputStream.writeIfAbsent(
    joinPath(basePath, `${name}.provider.json`),
    defaultProvider(name),
    { force: options?.force }
  );

  if (created) {
    options?.logCb?.(`-> Created ${name}.provider.json`);
  }
}
