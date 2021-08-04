import { Profile, Provider, SuperfaceClient } from '@superfaceai/one-sdk';
import { back, back as nockBack } from 'nock';
import { join as joinPath } from 'path';
import { TEST_CONFIG } from '../common';

import { developerError } from '../common/error';
import { removeTimestamp } from '../common/format';
import { detectTestConfig } from '../common/io';
import { TestConfig, TestingInput } from '../common/test-config';

let fixturePath: string;

export function test(): void {
  const configPath = detectTestConfig(process.cwd());

  if (!configPath) {
    throw developerError('Test configuration file has not been found', 1);
  }

  const config = TestConfig.loadSync(joinPath(configPath, TEST_CONFIG));
  fixturePath = joinPath(configPath, '.cache', 'nock');

  for (const entry of config.configuration.entries()) {
    templatedTest(entry);
  }
}

export function templatedTest([index, config]: [
  index: number,
  config: TestingInput
]): void {
  nockBack.fixtures = fixturePath;
  nockBack.setMode('record');

  describe(`${config.profileId}/${config.provider}`, () => {
    let client: SuperfaceClient;
    let profile: Profile;
    let provider: Provider;

    beforeAll(async () => {
      jest.setTimeout(10000);

      client = new SuperfaceClient();
      profile = await client.getProfile(config.profileId);
      provider = await client.getProvider(config.provider);

      process.env.SUPERFACE_DISABLE_METRIC_REPORTING = 'true';
    });

    it('should have profile defined', () => {
      expect(profile).toBeDefined();
    });

    it('should have provider defined', () => {
      expect(provider).toBeDefined();
    });

    describe('testing cases', () => {
      let nockDone: () => void;

      beforeAll(async () => {
        ({ nockDone } = await back(
          `${config.profileId}-${config.provider}-${index}.json`
        ));
      });

      afterAll(() => {
        nockDone();
      });

      for (const [i, test] of config.data.entries()) {
        it(`${i + 1} - ${test.useCase}`, async () => {
          const useCase = profile.getUseCase(test.useCase);

          expect(useCase).toBeDefined();

          // TODO: fix unknown types
          const result = await useCase.perform(test.input as any, { provider });

          if (test.isError) {
            expect(result.isErr()).toBeTruthy();
            expect(
              result.isErr() && removeTimestamp(result.error.message)
            ).toMatchSnapshot();
          } else {
            expect(result.isOk()).toBeTruthy();
            expect(result.isOk() && result.value).toMatchSnapshot();
          }
        });
      }
    });
  });
}
