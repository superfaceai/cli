import { Profile, Provider, SuperfaceClient } from '@superfaceai/one-sdk';
import { expect, use as useChai } from 'chai';
import chaiJestSnapshot from 'chai-jest-snapshot';
import Mocha from 'mocha';
import { back, back as nockBack } from 'nock';
import { join as joinPath } from 'path';

import { TEST_CONFIG } from '../common';
import { removeTimestamp } from '../common/format';
import { LogCallback } from '../common/log';
import { runMochaTests, suite } from '../common/mocha-setup';
import { TestConfig, TestingInput } from '../common/test-config';

export async function runTest(
  configPath: string,
  options?: {
    logCb?: LogCallback;
    errorCb?: LogCallback;
  }
): Promise<void> {
  useChai(chaiJestSnapshot);
  prepareTests(configPath);

  try {
    runMochaTests();
    options?.logCb?.('Templated test was executed with mocha');
  } catch (error) {
    options?.errorCb?.(error);
  }
}

export function prepareTests(configPath: string): void {
  const config = TestConfig.loadSync(joinPath(configPath, TEST_CONFIG));

  nockBack.fixtures = joinPath(configPath, '.cache', 'nock');
  nockBack.setMode('record');

  const parentSuiteName = suite('superface test');
  parentSuiteName.beforeAll(() => {
    chaiJestSnapshot.setFilename(
      joinPath(configPath, '.cache', 'snapshot.snap')
    );
  });

  for (const entry of config.configuration.entries()) {
    templatedTest(entry, parentSuiteName);
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

  const testInputSuite = Mocha.Suite.create(
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

  const testCaseSuite = Mocha.Suite.create(testInputSuite, 'testing cases');

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
        chaiJestSnapshot.setTestName(`${i + 1} - ${testCase.useCase}`);

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
          expect(result.isOk() && result.value).to.matchSnapshot();
        }
      })
    );
  }
}
