import { SuperJson } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import { Netrc } from 'netrc-parser';
import { join as joinPath } from 'path';

import { mkdir, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import {
  ENTER,
  execCLI,
  mockResponsesForMap,
  mockResponsesForProfile,
  mockResponsesForProfileProviders,
  mockResponsesForProvider,
  mockResponsesForPublish,
  setUpTempDir,
} from '../test/utils';

const mockServer = getLocal();

describe('Publish CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  let tempDir: string;
  const provider = 'swapi';
  const profileId = ProfileId.fromId('starwars/character-information');
  const profileVersion = '1.0.2';

  const netRc = new Netrc();
  let originalNetrcRecord: { baseUrl?: string; password?: string };
  const mockRefreshToken = 'RT';

  const sourceFixture = {
    profile: joinPath(
      'fixtures',
      'profiles',
      'starwars',
      'character-information.supr'
    ),
    profileWithVersion: joinPath(
      'fixtures',
      'profiles',
      'starwars',
      'character-information@1.0.2.supr'
    ),
    map: joinPath(
      'fixtures',
      'profiles',
      'starwars',
      'maps',
      'swapi.character-information.suma'
    ),
    provider: joinPath('fixtures', 'providers', 'swapi.json'),
  };

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
    await mockServer.start();
    await mockResponsesForProfile(mockServer, profileId.id);
    await mockResponsesForProfile(
      mockServer,
      'starwars/character-information@1.0.2'
    );
    await mockResponsesForProfileProviders(
      mockServer,
      [provider],
      profileId.id
    );
    await mockResponsesForProvider(mockServer, 'swapi');
    await mockResponsesForMap(
      mockServer,
      { name: 'character-information', scope: 'starwars' },
      provider
    );
    await mockResponsesForMap(
      mockServer,
      {
        name: 'character-information',
        scope: 'starwars',
        version: profileVersion,
      },
      provider
    );
    await mockResponsesForPublish(mockServer);

    //Load existing netrc and prepare mock
    await netRc.load();
    if (netRc.machines[mockServer.url]) {
      originalNetrcRecord = netRc.machines[mockServer.url];
    }
    netRc.machines[mockServer.url] = { password: mockRefreshToken };
    await netRc.save();
  });
  beforeEach(async () => {
    tempDir = await setUpTempDir(TEMP_PATH);
  });

  afterEach(async () => {
    await rimraf(tempDir);
  });

  afterAll(async () => {
    //If there was a value keep it
    if (originalNetrcRecord) {
      netRc.machines[mockServer.url] = originalNetrcRecord;
    } else {
      delete netRc.machines[mockServer.url];
    }
    await netRc.save();

    await mockServer.stop();
  });
  describe('when publishing profile', () => {
    it('publishes profile with local map and provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId.id]: {
            file: `../../../../${sourceFixture.profile}`,
            providers: {
              [provider]: {
                file: `../../../../${sourceFixture.map}`,
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: `../../../../${sourceFixture.provider}`,
          },
        },
      });

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        mockSuperJson.stringified
      );

      const result = await execCLI(
        tempDir,
        [
          'publish',
          'profile',
          '--profileId',
          profileId.id,
          '--providerName',
          provider,
        ],
        mockServer.url,
        {
          inputs: [
            //Confirm publish
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
            //Confirm transition
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
          ],
        }
      );
      expect(result.stdout).toContain(
        `Profile: "${profileId.id}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Map for profile: "${profileId.id}" and provider: "${provider}" found on local filesystem`
      );
      expect(result.stdout).toContain(
        `Provider: "${provider}" found on local file system`
      );
      expect(result.stdout).toContain(`Publishing profile "${profileId.name}"`);
      expect(result.stdout).toContain(
        `🆗 profile has been published successfully.`
      );

      //Check super.json
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual({
        profiles: {
          [profileId.id]: {
            version: '1.0.1',
            providers: {
              [provider]: {
                file: `../../../../${sourceFixture.map}`,
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: `../../../../${sourceFixture.provider}`,
          },
        },
      });
    }, 30000);

    it('publishes profile with remote map and provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId.id]: {
            file: `../../../../${sourceFixture.profile}`,
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        mockSuperJson.stringified
      );

      const result = await execCLI(
        tempDir,
        [
          'publish',
          'profile',
          '--profileId',
          profileId.id,
          '--providerName',
          provider,
        ],
        mockServer.url,
        {
          inputs: [
            //Confirm publish
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
            //Confirm transition
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
          ],
        }
      );
      expect(result.stdout).toContain(
        `Profile: "${profileId.id}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Loading map for profile: "${profileId.id}" and provider: "${provider}" from Superface store`
      );
      expect(result.stdout).toContain(
        `Loading provider: "${provider}" from Superface store`
      );
      expect(result.stdout).toContain(`Publishing profile "${profileId.name}"`);
      expect(result.stdout).toContain(
        `🆗 profile has been published successfully.`
      );

      //Check super.json
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual({
        profiles: {
          [profileId.id]: {
            version: '1.0.1',
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
    }, 30000);

    it('publishes map with local profile and provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId.id]: {
            file: `../../../../${sourceFixture.profile}`,
            providers: {
              [provider]: {
                file: `../../../../${sourceFixture.map}`,
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: `../../../../${sourceFixture.provider}`,
          },
        },
      });

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        mockSuperJson.stringified
      );

      const result = await execCLI(
        tempDir,
        [
          'publish',
          'map',
          '--profileId',
          profileId.id,
          '--providerName',
          provider,
        ],
        mockServer.url,
        {
          inputs: [
            //Confirm publish
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
            //Confirm transition
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
          ],
        }
      );
      expect(result.stdout).toContain(
        `Profile: "${profileId.id}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Map for profile: "${profileId.id}" and provider: "${provider}" found on local filesystem`
      );
      expect(result.stdout).toContain(
        `Provider: "${provider}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Publishing map for profile "${profileId.name}" and provider "${provider}"`
      );
      expect(result.stdout).toContain(
        `🆗 map has been published successfully.`
      );

      //Check super.json
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual({
        profiles: {
          [profileId.id]: {
            file: `../../../../${sourceFixture.profile}`,
            priority: [provider],
            providers: {
              [provider]: {
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: `../../../../${sourceFixture.provider}`,
            security: [
              {
                apikey: '$SWAPI_API_KEY',
                id: 'api',
              },
              {
                id: 'bearer',
                token: '$SWAPI_TOKEN',
              },
              {
                id: 'basic',
                password: '$SWAPI_PASSWORD',
                username: '$SWAPI_USERNAME',
              },
              {
                digest: '$SWAPI_DIGEST',
                id: 'digest',
              },
            ],
          },
        },
      });
    }, 30000);

    it('publishes map with remote profile and provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId.id]: {
            version: profileVersion,
            providers: {
              [provider]: {
                file: `../../../../${sourceFixture.map}`,
              },
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        mockSuperJson.stringified
      );

      const result = await execCLI(
        tempDir,
        [
          'publish',
          'map',
          '--profileId',
          profileId.id,
          '--providerName',
          provider,
        ],
        mockServer.url,
        {
          inputs: [
            //Confirm publish
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
            //Confirm transition
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
          ],
        }
      );
      expect(result.stdout).toContain(
        `Loading profile: "${profileId.id}@${profileVersion}" from Superface store`
      );
      expect(result.stdout).toContain(
        `Map for profile: "${profileId.id}@${profileVersion}" and provider: "${provider}" found on local filesystem`
      );
      expect(result.stdout).toContain(
        `Loading provider: "${provider}" from Superface store`
      );
      expect(result.stdout).toContain(
        `Publishing map for profile "${profileId.name}" and provider "${provider}"`
      );
      expect(result.stdout).toContain(
        `🆗 map has been published successfully.`
      );

      //Check super.json
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual({
        profiles: {
          [profileId.id]: {
            priority: [provider],
            version: profileVersion,
            providers: {
              [provider]: {
              },
            },
          },
        },
        providers: {
          [provider]: {
            security: [
              {
                apikey: '$SWAPI_API_KEY',
                id: 'api',
              },
              {
                id: 'bearer',
                token: '$SWAPI_TOKEN',
              },
              {
                id: 'basic',
                password: '$SWAPI_PASSWORD',
                username: '$SWAPI_USERNAME',
              },
              {
                digest: '$SWAPI_DIGEST',
                id: 'digest',
              },
            ],
          },
        },
      });
    }, 30000);

    it('publishes provider with local profile and map', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId.id]: {
            file: `../../../../${sourceFixture.profile}`,
            providers: {
              [provider]: {
                file: `../../../../${sourceFixture.map}`,
              },
            },
          },
        },
        providers: {
          [provider]: {
            file: `../../../../${sourceFixture.provider}`,
          },
        },
      });

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        mockSuperJson.stringified
      );

      const result = await execCLI(
        tempDir,
        [
          'publish',
          'provider',
          '--profileId',
          profileId.id,
          '--providerName',
          provider,
        ],
        mockServer.url,
        {
          inputs: [
            //Confirm publish
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
            //Confirm transition
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
          ],
        }
      );
      expect(result.stdout).toContain(
        `Profile: "${profileId.id}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Map for profile: "${profileId.id}" and provider: "${provider}" found on local filesystem`
      );
      expect(result.stdout).toContain(
        `Provider: "${provider}" found on local file system`
      );
      expect(result.stdout).toContain(`Publishing provider "${provider}"`);
      expect(result.stdout).toContain(
        `🆗 provider has been published successfully.`
      );

      //Check super.json
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual({
        profiles: {
          [profileId.id]: {
            priority: [provider],
            file: `../../../../${sourceFixture.profile}`,
            providers: {
              [provider]: {
                file: `../../../../${sourceFixture.map}`,
              },
            },
          },
        },
        providers: {
          [provider]: {
            security: [
              {
                apikey: '$SWAPI_API_KEY',
                id: 'api',
              },
              {
                id: 'bearer',
                token: '$SWAPI_TOKEN',
              },
              {
                id: 'basic',
                password: '$SWAPI_PASSWORD',
                username: '$SWAPI_USERNAME',
              },
              {
                digest: '$SWAPI_DIGEST',
                id: 'digest',
              },
            ],
          },
        },
      });
    }, 30000);

    it('publishes provider with remote profile and map', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId.id]: {
            version: profileVersion,
            priority: [provider],
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {
            file: `../../../../${sourceFixture.provider}`,
          },
        },
      });

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        mockSuperJson.stringified
      );

      const result = await execCLI(
        tempDir,
        [
          'publish',
          'provider',
          '--profileId',
          profileId.id,
          '--providerName',
          provider,
        ],
        mockServer.url,
        {
          inputs: [
            //Confirm publish
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
            //Confirm transition
            { value: 'y', timeout: 4000 },
            { value: ENTER, timeout: 500 },
          ],
        }
      );
      expect(result.stdout).toContain(
        `Loading profile: "${profileId.id}@${profileVersion}" from Superface store`
      );
      expect(result.stdout).toContain(
        `Loading map for profile: "${profileId.id}@${profileVersion}" and provider: "${provider}" from Superface store`
      );
      expect(result.stdout).toContain(
        `Provider: "${provider}" found on local file system`
      );
      expect(result.stdout).toContain(`Publishing provider "${provider}"`);
      expect(result.stdout).toContain(
        `🆗 provider has been published successfully.`
      );

      //Check super.json
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document).toEqual({
        profiles: {
          [profileId.id]: {
            version: profileVersion,
            priority: [provider],
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {
            security: [
              {
                apikey: '$SWAPI_API_KEY',
                id: 'api',
              },
              {
                id: 'bearer',
                token: '$SWAPI_TOKEN',
              },
              {
                id: 'basic',
                password: '$SWAPI_PASSWORD',
                username: '$SWAPI_USERNAME',
              },
              {
                digest: '$SWAPI_DIGEST',
                id: 'digest',
              },
            ],
          },
        },
      });
    }, 30000);
  });
});
