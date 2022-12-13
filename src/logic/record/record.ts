import type {
  NormalizedSuperJsonDocument,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';
import { castToNonPrimitive, DEFAULT_CACHE_PATH } from '@superfaceai/one-sdk';

import { dirname, join as joinPath } from 'path';
import { inspect } from 'util';
import type { ILogger } from '../../common';
import type { UserError } from '../../common/error';
import { mkdir } from '../../common/io';
import { OutputStream } from '../../common/output-stream';
import type { ProfileId } from '../../common/profile';
import { loadMap, loadProfile, loadProvider } from '../publish.utils';
import { createBoundProfileProvider } from './create-bound-profile-provider';
import { prepareExampleInput } from './prepare-example-input';

export async function record(
  {
    superJson,
    superJsonPath,
    profile,
    provider,
    map,
    version,
    useCaseName,
  }: {
    superJson: NormalizedSuperJsonDocument;
    superJsonPath: string;
    profile: ProfileId;
    provider: string;
    map: {
      variant?: string;
    };
    version?: string;
    useCaseName: string;
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
) {
  // Profile
  const profileFiles = await loadProfile(
    { superJson, superJsonPath, profile, version },
    { logger }
  );
  if (profileFiles.from.kind !== 'local') {
    throw userError(
      `Profile: "${profile.id}" not found on local file system`,
      1
    );
  }

  const useCase = profileFiles.ast.definitions
    .filter((d): d is UseCaseDefinitionNode => d.kind === 'UseCaseDefinition')
    .find(u => u.useCaseName === useCaseName);

  if (useCase === undefined) {
    throw userError(`Use case: "${useCaseName}" not found in profile`, 1);
  }

  const example = prepareExampleInput(useCase);

  // Map
  const mapFiles = await loadMap(
    { superJson, superJsonPath, profile, provider, map, version },
    { logger }
  );
  if (mapFiles.from.kind !== 'local') {
    throw userError(
      `Map for profile: "${profile.id}" and provider: "${provider}" not found on local filesystem`,
      1
    );
  }

  // Provider
  const providerFiles = await loadProvider(superJson, superJsonPath, provider, {
    logger,
  });

  if (providerFiles.from.kind === 'remote') {
    throw userError(
      `Provider: "${provider}" not found on local file system`,
      1
    );
  }

  const b = createBoundProfileProvider({
    superJson,
    profileAst: profileFiles.ast,
    mapAst: mapFiles.ast,
    providerJson: providerFiles.source,
  });

  const result = await b.perform(
    useCase.useCaseName,
    castToNonPrimitive(example)
  );

  const value: unknown = result.result.unwrap();

  console.log('valie', inspect(value, true, 20));

  const cachePath = DEFAULT_CACHE_PATH({
    // eslint-disable-next-line @typescript-eslint/unbound-method
    path: { join: joinPath, cwd: process.cwd },
  });
  
  const path = joinPath(cachePath, 'records.json') 

  console.log('path', path)

  await mkdir( dirname(path), {recursive: true})

  await OutputStream.writeOnce(path, JSON.stringify({[`${profile.id}.${provider}`]: result.trace}, undefined, 2), { force: true})



}
