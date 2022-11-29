import type { SuperJsonDocument } from '@superfaceai/ast';

import type { ILogger } from '../../common';
import { OutputStream } from '../../common/output-stream';
import type { ProfileId } from '../../common/profile';
import { prepareTestTemplate } from '../../templates/prepared-test/prepare-test';
import { loadProfile } from '../publish.utils';

/**
 * Prepares test file fromn profile examples for specified profile and provider
 * @param superJson SuperJson defining used profile and provider
 * @param profile ProfileId of used profile
 * @param provider provider name
 * @param path optional path to test file
 * @param fileName optional name of test file
 * @param version optional version of used profile
 */
export async function prepareTest(
  {
    superJson,
    superJsonPath,
    profile,
    provider,
    version,
    options,
  }: {
    superJson: SuperJsonDocument;
    superJsonPath: string;
    profile: ProfileId;
    provider: string;
    version?: string;
    options: {
      force?: boolean;
      station?: boolean;
    };
  },
  { logger }: { logger: ILogger }
): Promise<void> {
  const { ast } = await loadProfile(
    { superJson, superJsonPath, profile, version },
    { logger }
  );

  // TODO: Only local files?
  const testFileContent = prepareTestTemplate(ast, provider);

  let filePath: string;

  if (options?.station === true) {
    filePath = `grid/${profile.id}/maps/${provider}.test.ts`;
  } else {
    filePath = `${profile.id}.${provider}.test.ts`;
  }

  await OutputStream.writeOnce(filePath, testFileContent, {
    dirs: true,
    force: options.force,
  });
}
