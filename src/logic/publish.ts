import { isMapDocumentNode, isProfileDocumentNode } from '@superfaceai/ast';
import { isProviderJson } from '@superfaceai/one-sdk';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';

import { EXTENSIONS } from '../common';
import { userError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { exists, readFile } from '../common/io';
import { LogCallback } from '../common/log';

export async function publish(
  path: string,
  // baseUrl: string,
  options?: {
    logCb?: LogCallback;
    dryRun?: boolean;
  }
): Promise<void> {
  if (!(await exists(path))) {
    throw userError('Path does not exist', 1);
  }
  //TODO: check if user is logged in
  // if (!process.env.SUPERFACE_STORE_REFRESH_TOKEN) {
  //   throw userError('Env variable SUPERFACE_STORE_REFRESH_TOKEN is missing', 1);
  // }
  if (
    path.endsWith(EXTENSIONS.map.build) ||
    path.endsWith(EXTENSIONS.profile.build)
  ) {
    throw userError(
      'Please use a .supr or .suma file instead of .ast.json compiled file',
      1
    );
  }

  const file = await readFile(path, { encoding: 'utf-8' });
  //TODO: check if user is logged in
  const client = SuperfaceClient.getClient();

  if (path.endsWith(EXTENSIONS.provider)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsedFile = JSON.parse(file);
    if (isProviderJson(parsedFile)) {
      options?.logCb?.(`Publishing provider ${parsedFile.name} from: ${path}`);

      if (!options?.dryRun) {
        await client.createProvider(file);
      }
    } else {
      throw userError('File does not have provider json structure', 1);
    }
  } else if (path.endsWith(EXTENSIONS.profile.source)) {
    //TODO: use sdk parser to cache ast
    const parsedFile = parseProfile(new Source(file, path));
    //TODO: some better way of validation
    if (isProfileDocumentNode(parsedFile)) {
      options?.logCb?.(
        `Publishing profile "${parsedFile.header.name}" from: ${path}`
      );
      if (!options?.dryRun) {
        await client.createProfile(file);
      }
    } else {
      throw userError('Unknown profile file structure', 1);
    }
  } else if (path.endsWith(EXTENSIONS.map.source)) {
    //TODO: use sdk parser to cache ast
    const parsedFile = parseMap(new Source(file, path));
    //TODO: some better way of validation
    if (isMapDocumentNode(parsedFile)) {
      options?.logCb?.(
        `Publishing map for profile "${parsedFile.header.profile.name}" and provider "${parsedFile.header.provider}" from: ${path}`
      );

      if (!options?.dryRun) {
        await client.createMap(file);
      }
    } else {
      throw userError('Unknown map file structure', 1);
    }
  } else {
    throw userError('Unknown file extension', 1);
  }
}
