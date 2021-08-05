import { Profile, Provider, SuperfaceClient } from '@superfaceai/one-sdk';
import { expect, use as useChai } from 'chai';
import chaiJestSnapshot from 'chai-jest-snapshot';
import Mocha from 'mocha';
import { back, back as nockBack, restore as restoreNocks } from 'nock';
import { join as joinPath } from 'path';

import { removeTimestamp } from '../common/format';
import { removeDirQuiet, removeFileQuiet } from '../common/io';
import { LogCallback } from '../common/log';
import { TestConfig, TestingInput } from '../common/test-config';
import { runMochaTests, suite } from '../test/mocha-utils';

export async function runTest(
  configPath: string,
  testName?: string,
  options?: {
    logCb?: LogCallback;
    errorCb?: LogCallback;
  }
): Promise<void> {
  // set up snapshot matcher .to.matchSnapshot()
  useChai(chaiJestSnapshot);

  const config = await TestConfig.load(configPath, testName);
  const mocha = new Mocha({ timeout: 15000 });
  prepareTests(mocha, config);

  try {
    await runMochaTests(mocha);
    options?.logCb?.('Templated test was executed with mocha');
  } catch (error) {
    options?.errorCb?.(error);
  }

  restoreNocks();
  mocha.dispose();
}

export function prepareTests(mocha: Mocha, config: TestConfig): void {
  nockBack.fixtures = joinPath(config.path, '.cache', 'nock');
  nockBack.setMode('record');

  const parentSuite = suite(mocha.suite, '$ superface test');
  parentSuite.beforeAll(() => {
    chaiJestSnapshot.setFilename(
      joinPath(config.path, '.cache', 'snapshot.snap')
    );
  });

  for (const entry of config.configuration.entries()) {
    templatedTest(entry, parentSuite);
  }
}

export function templatedTest(
  [index, config]: [index: number, config: TestingInput],
  parentSuite: Mocha.Suite
): void {
  let client: SuperfaceClient;
  let profile: Profile;
  let provider: Provider;
  let nockDone: () => void;

  const testInputSuite = suite(
    parentSuite,
    `${config.profileId}/${config.provider}`
  );

  testInputSuite.beforeAll(async () => {
    client = new SuperfaceClient();
    profile = await client.getProfile(config.profileId);
    provider = await client.getProvider(config.provider);

    process.env.SUPERFACE_DISABLE_METRIC_REPORTING = 'true';
  });

  testInputSuite.addTest(
    new Mocha.Test('should have profile defined', () => {
      expect(profile).not.to.be.undefined;
    })
  );

  testInputSuite.addTest(
    new Mocha.Test('should have provider defined', () => {
      expect(provider).not.to.be.undefined;
    })
  );

  const testCaseSuite = suite(testInputSuite, 'testing cases');

  testCaseSuite.beforeAll(async () => {
    ({ nockDone } = await back(
      `${config.profileId}-${config.provider}-${index}.json`
    ));
  });

  testCaseSuite.afterAll(() => {
    nockDone();
  });

  for (const [i, testCase] of config.data.entries()) {
    testCaseSuite.addTest(
      new Mocha.Test(`${i + 1} - ${testCase.useCase}`, async () => {
        chaiJestSnapshot.setTestName(testCase.useCase);

        const useCase = profile.getUseCase(testCase.useCase);
        expect(useCase).not.to.be.undefined;

        // TODO: fix unknown types
        const result = await useCase.perform(testCase.input as any, {
          provider,
        });

        if (testCase.isError) {
          expect(result.isErr()).to.be.true;
          expect(
            result.isErr() && removeTimestamp(result.error.message)
          ).to.matchSnapshot();
        } else {
          expect(result.isOk()).to.be.true;

          if (testCase.result) {
            expect(result.isOk() && result.value).to.deep.equal(
              testCase.result
            );
          } else {
            expect(result.isOk() && result.value).to.matchSnapshot();
          }
        }
      })
    );
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
) {
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
) {
  options?.logCb?.('Updating nock http recordings');
  try {
    await removeFileQuiet(joinPath(configPath, '.cache', 'snapshot.snap'));
  } catch (error) {
    options?.errorCb?.(error);
  }
}

export async function updateMocksAndRecordings(
  configPath: string,
  {
    updateSnapshots,
    updateRecordings,
  }: { updateSnapshots: boolean; updateRecordings: boolean },
  options?: {
    logCb?: LogCallback;
    errorCb?: LogCallback;
  }
): Promise<void> {
  if (updateSnapshots) {
    await updatePresentSnapshot(configPath, options);
  }

  if (updateRecordings) {
    await updatePresentMocks(configPath, options);
  }
}
