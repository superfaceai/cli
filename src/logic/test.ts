import { SuperfaceClient } from '@superfaceai/one-sdk';
import { back, back as nockBack, restore as restoreNocks } from 'nock';
import { join as joinPath } from 'path';
import tap from 'tap';

import { removeDirQuiet, removeFileQuiet } from '../common/io';
import { LogCallback } from '../common/log';
import { TestConfig, TestingInput } from '../common/test-config';

export async function runTest(
  config: {
    path: string;
    updateSnapshots: boolean;
    updateRecordings: boolean;
    testName?: string;
  },
  options?: {
    logCb?: LogCallback;
    errorCb?: LogCallback;
  }
): Promise<void> {
  const testConfig = await TestConfig.load(config);

  try {
    await prepareTests(testConfig);
    options?.logCb?.('Templated test was executed with tap');
  } catch (error) {
    options?.errorCb?.(error);
  }

  restoreNocks();
}

export async function prepareTests(config: TestConfig): Promise<void> {
  if (config.updateSnapshots) {
    await updatePresentSnapshot(config.path);
  }

  if (config.updateRecordings) {
    await updatePresentMocks(config.path);
  }

  nockBack.fixtures = joinPath(config.path, '.cache', 'nock');
  nockBack.setMode('record');

  await tap.test('$ superface test', { bail: false }, async t => {
    t.plan(config.configuration.length);

    for (const entry of config.configuration.entries()) {
      await templatedTest(t, entry);
    }
  });
}

export async function templatedTest(
  parent: Tap.Test,
  [index, config]: [index: number, config: TestingInput]
): Promise<void> {
  const client = new SuperfaceClient();
  const profile = await client.getProfile(config.profileId);
  const provider = await client.getProvider(config.provider);
  let nockDone: () => void;

  await parent.test(
    `${config.profileId}/${config.provider}`,
    async testingInput => {
      testingInput.plan(3);

      await testingInput.test('should have profile defined', t => {
        t.ok(profile);
      });

      await testingInput.test('should have provider defined', t => {
        t.ok(provider);
      });

      await testingInput.test('testing cases', async testingCase => {
        testingCase.plan(config.data.length);
        testingCase.before(async () => {
          ({ nockDone } = await back(
            `${config.profileId}-${config.provider}-${index}.json`
          ));
        });

        for (const [i, testCase] of config.data.entries()) {
          await testingCase.test(`${i + 1} - ${testCase.useCase}`, async t => {
            const useCase = profile.getUseCase(testCase.useCase);
            t.ok(useCase);

            // TODO: fix unknown types
            const result = await useCase.perform(testCase.input as any, {
              provider,
            });

            if (testCase.isError) {
              t.ok(result.isErr());

              // expect(
              //   result.isErr() && removeTimestamp(result.error.message)
              // ).to.matchSnapshot();
            } else {
              t.ok(result.isOk());

              if (testCase.result) {
                t.equal(result.isOk() && result.value, testCase.result);
              } else {
                // expect(result.isOk() && result.value).to.matchSnapshot();
              }
            }
          });
        }

        nockDone();
      });
    }
  );
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

/**
 * Updates snapshot located in <project-dir>/superface/.cache/
 */
export async function updatePresentSnapshot(
  configPath: string,
  options?: {
    logCb?: LogCallback;
    errorCb?: LogCallback;
  }
): Promise<void> {
  options?.logCb?.('Updating nock http recordings');
  try {
    await removeFileQuiet(joinPath(configPath, '.cache', 'snapshot.snap'));
  } catch (error) {
    options?.errorCb?.(error);
  }
}
