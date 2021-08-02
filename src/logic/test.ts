import { Profile, Provider, SuperfaceClient } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';

import { developerError } from '../common/error';
import { detectTestConfig } from '../common/io';
import { TestConfig, TestingInput } from '../common/test-config';

export function test(): void {
  const configPath = detectTestConfig(process.cwd());

  if (!configPath) {
    throw developerError('Test configuration file has not been found', 1);
  }

  const config = TestConfig.loadSync(configPath);

  for (const input of config.configuration) {
    templatedTest(input);
  }
}

export function templatedTest(config: TestingInput): void {
  const mockServer = getLocal();

  describe(`${config.profileId}/${config.provider}`, () => {
    let client: SuperfaceClient;
    let profile: Profile;
    let provider: Provider;

    beforeAll(async () => {
      jest.setTimeout(10000);
    });

    beforeEach(async () => {
      client = new SuperfaceClient();
      profile = await client.getProfile(config.profileId);
      provider = await client.getProvider(config.provider);

      if (config.mockedRequests) {
        await mockServer.start();

        for (const res of config.mockedRequests) {
          switch (res.method) {
            case 'GET':
              await mockServer.get(res.url).thenJson(res.status, res.body);
              break;
            case 'POST':
              await mockServer.post(res.url).thenJson(res.status, res.body);
              break;
          }
        }
      }
    });

    afterAll(async () => {
      if (config.mockedRequests) {
        await mockServer.stop();
      }
    });

    it('should have profile defined', () => {
      expect(profile).toBeDefined();
    });

    it('should have provider defined', () => {
      expect(provider).toBeDefined();
    });

    for (const data of config.data) {
      it('should perform correctly', async () => {
        // await mockServer
        //   .get('https://swapi.dev/api/people/')
        //   .thenJson(404, { data: 'not found' });

        const usecase = profile.getUseCase(data.usecase);
        expect(usecase).not.toBeUndefined();

        // TODO: fix unknown types
        const result = await usecase.perform(data.input as any, {
          provider,
        });

        if (data.isError) {
          expect(result.isErr()).toBeTruthy();
          expect(() => {
            result.unwrap();
          }).toThrow();
        } else {
          expect(result.isOk()).toBeTruthy();
          expect(result.unwrap()).toEqual(data.result);
        }
      });
    }
  });
}
