import { run as runJest } from 'jest';
import { back as nockBack, restore as restoreNocks } from 'nock';
import { join as joinPath } from 'path';

import { removeDirQuiet } from '../common/io';
import { LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { TestConfig, TestingInput } from '../common/test-config';
import { buildTest } from '../templates/jest-test';

// TODO: centralize TestConfig 

export async function executeJest(
  config: TestConfig,
  options?: {
    logCb?: LogCallback;
    errorCb?: LogCallback;
  }
): Promise<void> {
  const argv = [];

  if (config.testName !== undefined) {
    argv.push(`${config.testName}.test.ts`);
  }

  if (config.updateSnapshots) {
    argv.push('--updateSnapshot');
  }

  try {
    await runJest(argv, process.cwd());
  } catch (error) {
    options?.errorCb?.(error);
  }
}

export async function test(
  [index, config]: [index: number, config: TestingInput],
  testConfig: TestConfig,
  options?: {
    logCb?: LogCallback;
    errorCb?: LogCallback;
  }
) {
  const { nockDone } = await nockBack(
    `${config.profileId}-${config.provider}-${index}.json`
  );

  await executeJest(testConfig, options);

  nockDone();
}

export async function generateTest(
  [index, config]: [index: number, config: TestingInput],
  path: string,
  options?: {
    logCb?: LogCallback;
    errorCb?: LogCallback;
    force?: boolean;
  }
) {
  const [scope, profile] = config.profileId.split('/');
  const fileName = `${scope}-${profile}-${config.provider}-${index}.test.ts`;
  const testPath = joinPath(path, '.cache', '__tests__', fileName);

  const created = await OutputStream.writeIfAbsent(
    testPath,
    buildTest([index, config]),
    {
      force: options?.force,
      dirs: true,
    }
  );

  if (created) {
    options?.logCb?.(`Created test file ${fileName} in ${path}`);
  }
}

/**
 * Updates nock http recordings located in <project-dir>/superface/.cache/nock/
 */
 export async function updatePresentMocks(
  configPath: string,
  options?: {
    logCb?: LogCallback;
    errorCb?: LogCallback;
  }
): Promise<void> {
  options?.logCb?.('Updating nock http recordings');
  try {
    await removeDirQuiet(joinPath(configPath, '.cache', 'nock'));
  } catch (error) {
    options?.errorCb?.(error);
  }
}

export async function runTests(
  config: {
    path: string;
    updateSnapshots: boolean;
    updateRecordings: boolean;
    testName?: string;
  },
  options?: {
    logCb?: LogCallback;
    errorCb?: LogCallback;
    force?: boolean;
  }
): Promise<void> {
  const testConfig = await TestConfig.load(config);

  try {
    if (testConfig.updateRecordings) {
      await updatePresentMocks(testConfig.path);
    }

    nockBack.fixtures = joinPath(testConfig.path, '.cache', 'nock');
    nockBack.setMode('record');

    for (const entry of testConfig.configuration.entries()) {
      // TODO: add check or prompt
      await generateTest(entry, testConfig.path, options);
      await test(entry, testConfig, options);
    }
  } catch (error) {
    options?.errorCb?.(error);
  }

  restoreNocks();
}
