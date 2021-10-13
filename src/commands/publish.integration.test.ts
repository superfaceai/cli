import { SuperJson } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import { Netrc } from 'netrc-parser';
import { join as joinPath } from 'path';

import { UNVERIFIED_PROVIDER_PREFIX } from '../common';
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
  let NETRC_FILENAME: string;
  const provider = 'swapi';
  const unverifiedProvider = `${UNVERIFIED_PROVIDER_PREFIX}swapi`;
  const profileId = ProfileId.fromId('starwars/character-information');
  const profileVersion = '1.0.2';

  // const netRc = new Netrc();
  // let originalNetrcRecord: { baseUrl?: string; password?: string };
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
    mapWithUnverifiedProvider: joinPath(
      'fixtures',
      'profiles',
      'starwars',
      'maps',
      'unverified-swapi.character-information.suma'
    ),
    provider: joinPath('fixtures', 'providers', 'swapi.json'),
    unverifiedProvider: joinPath(
      'fixtures',
      'providers',
      'unverified-swapi.json'
    ),
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
      [provider, unverifiedProvider],
      profileId.id
    );
    await mockResponsesForProvider(mockServer, provider);
    await mockResponsesForProvider(mockServer, unverifiedProvider);
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
    await mockResponsesForMap(
      mockServer,
      { name: 'character-information', scope: 'starwars' },
      unverifiedProvider
    );
    await mockResponsesForMap(
      mockServer,
      {
        name: 'character-information',
        scope: 'starwars',
        version: profileVersion,
      },
      unverifiedProvider
    );
    await mockResponsesForPublish(mockServer);
  });
  beforeEach(async () => {
    //Test specific netrc
    tempDir = await setUpTempDir(TEMP_PATH, true);
    NETRC_FILENAME = '.netrc';

    //Set mock refresh token in netrc
    const netRc = new Netrc(joinPath(tempDir, NETRC_FILENAME));
    await netRc.load();
    netRc.machines[mockServer.url] = { password: mockRefreshToken };
    await netRc.save();
  });

  afterEach(async () => {
    await rimraf(tempDir);
  });

  afterAll(async () => {
    await mockServer.stop();
  });
  describe('when publishing profile', () => {
    it('publishes profile with local map and provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId.id]: {
            file: `../../../../${sourceFixture.profile}`,
            providers: {
              [unverifiedProvider]: {
                file: `../../../../${sourceFixture.mapWithUnverifiedProvider}`,
              },
            },
          },
        },
        providers: {
          [unverifiedProvider]: {
            file: `../../../../${sourceFixture.unverifiedProvider}`,
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
          unverifiedProvider,
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
          env: { NETRC_FILEPATH: NETRC_FILENAME },
        }
      );
      expect(result.stdout).toContain(
        `Profile: "${profileId.id}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Map for profile: "${profileId.id}" and provider: "${unverifiedProvider}" found on local filesystem`
      );
      expect(result.stdout).toContain(
        `Provider: "${unverifiedProvider}" found on local file system`
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
              [unverifiedProvider]: {
                file: `../../../../${sourceFixture.mapWithUnverifiedProvider}`,
              },
            },
          },
        },
        providers: {
          [unverifiedProvider]: {
            file: `../../../../${sourceFixture.unverifiedProvider}`,
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
              [unverifiedProvider]: {},
            },
          },
        },
        providers: {
          [unverifiedProvider]: {},
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
          unverifiedProvider,
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
          env: { NETRC_FILEPATH: NETRC_FILENAME },
        }
      );
      expect(result.stdout).toContain(
        `Profile: "${profileId.id}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Loading map for profile: "${profileId.id}" and provider: "${unverifiedProvider}" in version: "1.0.0" from Superface store`
      );
      expect(result.stdout).toContain(
        `Loading provider: "${unverifiedProvider}" from Superface store`
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
              [unverifiedProvider]: {},
            },
          },
        },
        providers: {
          [unverifiedProvider]: {},
        },
      });
    }, 30000);

    it('publishes map with local profile and provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId.id]: {
            file: `../../../../${sourceFixture.profile}`,
            providers: {
              [unverifiedProvider]: {
                file: `../../../../${sourceFixture.mapWithUnverifiedProvider}`,
              },
            },
          },
        },
        providers: {
          [unverifiedProvider]: {
            file: `../../../../${sourceFixture.unverifiedProvider}`,
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
          unverifiedProvider,
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
          env: { NETRC_FILEPATH: NETRC_FILENAME },
        }
      );
      expect(result.stdout).toContain(
        `Profile: "${profileId.id}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Map for profile: "${profileId.id}" and provider: "${unverifiedProvider}" found on local filesystem`
      );
      expect(result.stdout).toContain(
        `Provider: "${unverifiedProvider}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Publishing map for profile "${profileId.name}" and provider "${unverifiedProvider}"`
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
            providers: {
              [unverifiedProvider]: {},
            },
          },
        },
        providers: {
          [unverifiedProvider]: {
            file: `../../../../${sourceFixture.unverifiedProvider}`,
          },
        },
      });
    }, 30000);

    it('publishes map with remote profile and provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId.id]: {
            version: profileVersion,
            priority: [provider],
            providers: {
              [unverifiedProvider]: {
                file: `../../../../${sourceFixture.mapWithUnverifiedProvider}`,
              },
            },
          },
        },
        providers: {
          [unverifiedProvider]: {},
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
          unverifiedProvider,
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
          env: { NETRC_FILEPATH: NETRC_FILENAME },
        }
      );
      expect(result.stdout).toContain(
        `Loading profile: "${profileId.id}" in version: "${profileVersion}" from Superface store`
      );
      expect(result.stdout).toContain(
        `Map for profile: "${profileId.id}@${profileVersion}" and provider: "${unverifiedProvider}" found on local filesystem`
      );
      expect(result.stdout).toContain(
        `Loading provider: "${unverifiedProvider}" from Superface store`
      );
      expect(result.stdout).toContain(
        `Publishing map for profile "${profileId.name}" and provider "${unverifiedProvider}"`
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
            version: profileVersion,
            priority: [provider],
            providers: {
              [unverifiedProvider]: {},
            },
          },
        },
        providers: {
          [unverifiedProvider]: {},
        },
      });
    }, 30000);

    it('publishes provider with local profile and map', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId.id]: {
            file: `../../../../${sourceFixture.profile}`,
            providers: {
              [unverifiedProvider]: {
                file: `../../../../${sourceFixture.mapWithUnverifiedProvider}`,
              },
            },
          },
        },
        providers: {
          [unverifiedProvider]: {
            file: `../../../../${sourceFixture.unverifiedProvider}`,
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
          unverifiedProvider,
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
          env: { NETRC_FILEPATH: NETRC_FILENAME },
        }
      );
      expect(result.stdout).toContain(
        `Profile: "${profileId.id}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Map for profile: "${profileId.id}" and provider: "${unverifiedProvider}" found on local filesystem`
      );
      expect(result.stdout).toContain(
        `Provider: "${unverifiedProvider}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Publishing provider "${unverifiedProvider}"`
      );
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
            file: `../../../../${sourceFixture.profile}`,
            providers: {
              [unverifiedProvider]: {
                file: `../../../../${sourceFixture.mapWithUnverifiedProvider}`,
              },
            },
          },
        },
        providers: {
          [unverifiedProvider]: {},
        },
      });
    }, 30000);

    it('publishes provider with remote profile and map', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId.id]: {
            version: profileVersion,
            priority: [unverifiedProvider],
            providers: {
              [unverifiedProvider]: {},
            },
          },
        },
        providers: {
          [unverifiedProvider]: {
            file: `../../../../${sourceFixture.unverifiedProvider}`,
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
          unverifiedProvider,
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
          env: { NETRC_FILEPATH: NETRC_FILENAME },
        }
      );
      expect(result.stdout).toContain(
        `Loading profile: "${profileId.id}" in version: "${profileVersion}" from Superface store`
      );
      expect(result.stdout).toContain(
        `Loading map for profile: "${profileId.id}@${profileVersion}" and provider: "${unverifiedProvider}" in version: "1.0.0" from Superface store`
      );
      expect(result.stdout).toContain(
        `Provider: "${unverifiedProvider}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Publishing provider "${unverifiedProvider}"`
      );
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
            priority: [unverifiedProvider],
            providers: {
              [unverifiedProvider]: {},
            },
          },
        },
        providers: {
          [unverifiedProvider]: {},
        },
      });
    }, 30000);
  });
});
