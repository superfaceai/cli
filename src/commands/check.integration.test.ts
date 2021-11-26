import { SuperJson } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import { join as joinPath } from 'path';

import { UNVERIFIED_PROVIDER_PREFIX } from '../common';
import { mkdir, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import {
  execCLI,
  mockResponsesForMap,
  mockResponsesForProfile,
  mockResponsesForProfileProviders,
  mockResponsesForProvider,
  setUpTempDir,
} from '../test/utils';

const mockServer = getLocal();

describe('Check CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  let tempDir: string;
  const provider = `${UNVERIFIED_PROVIDER_PREFIX}swapi`;
  const profileId = 'starwars/character-information';
  const profileVersion = '1.0.2';

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
      'unverified-swapi.character-information.suma'
    ),
    provider: joinPath('fixtures', 'providers', 'unverified-swapi.json'),
  };

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
    await mockServer.start();
    await mockResponsesForProfile(mockServer, profileId);
    await mockResponsesForProfile(
      mockServer,
      'starwars/character-information@1.0.2'
    );
    await mockResponsesForProfileProviders(mockServer, [provider], profileId);
    await mockResponsesForProvider(mockServer, provider);

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
  });
  beforeEach(async () => {
    tempDir = await setUpTempDir(TEMP_PATH);
  });

  afterEach(async () => {
    await rimraf(tempDir);
  });

  afterAll(async () => {
    await mockServer.stop();
  });
  describe('when checking capability', () => {
    it('checks capability with local map, profile and provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
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
        ['check', '--profileId', profileId, '--providerName', provider],
        mockServer.url
      );
      expect(result.stdout).toContain(
        `Profile "${profileId}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Map for profile "${profileId}" and provider "${provider}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Provider "${provider}" found on local file system`
      );
      expect(result.stdout).toContain(
        'Checking profile "starwars/character-information" and map for provider "unverified-swapi"'
      );
      // Map and profile
      expect(result.stdout).toMatch(
        `🆗 Checking local profile "${profileId}@1.0.1" at path`
      );
      expect(result.stdout).toMatch(sourceFixture.profile);
      expect(result.stdout).toMatch(
        `and local map for provider "${provider}" at path`
      );
      expect(result.stdout).toMatch(sourceFixture.map);

      // Map and provider
      expect(result.stdout).toMatch('Checking local map at path');
      expect(result.stdout).toMatch(sourceFixture.map);
      expect(result.stdout).toMatch(
        `for profile "${profileId}" and local provider "unverified-swapi" at path`
      );
      expect(result.stdout).toMatch(sourceFixture.provider);
    });

    it('checks capability with local map', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
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
        ['check', '--profileId', profileId, '--providerName', provider],
        mockServer.url
      );
      expect(result.stdout).toContain(
        `Fetching profile "${profileId}" with version "${profileVersion}" from Superface registry`
      );
      expect(result.stdout).toContain(
        `Map for profile "${profileId}@${profileVersion}" and provider "${provider}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Fetching provider "${provider}" from Superface registry`
      );
      // Map and profile
      expect(result.stdout).toMatch(
        `🆗 Checking remote profile "${profileId}" with version "${profileVersion}" and local map for provider "${provider}" at path`
      );
      expect(result.stdout).toMatch(sourceFixture.map);
      // Map and provider
      expect(result.stdout).toMatch('Checking local map at path');

      expect(result.stdout).toMatch(
        `for profile "${profileId}" and remote provider "${provider}"`
      );
    });

    it('checks capability with local profile', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
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
        ['check', '--profileId', profileId, '--providerName', provider],
        mockServer.url
      );
      expect(result.stdout).toContain(
        `Profile "${profileId}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Fetching map for profile "${profileId}" and provider "${provider}" with version "1.0.0" from Superface registry`
      );
      expect(result.stdout).toContain(
        `Fetching provider "${provider}" from Superface registry`
      );
      //Map and profile
      expect(result.stdout).toMatch(
        `🆗 Checking local profile "${profileId}@1.0.1" at path`
      );

      expect(result.stdout).toMatch(sourceFixture.profile);

      expect(result.stdout).toMatch(
        `and remote map with version "1.0.0" for provider "${provider}"`
      );

      //Map and provider
      expect(result.stdout).toMatch(
        `🆗 Checking remote map with version "1.0.0" for profile "${profileId}" and remote provider "${provider}"`
      );
    });

    it('checks capability with local provider', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: profileVersion,
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
        ['check', '--profileId', profileId, '--providerName', provider],
        mockServer.url
      );
      expect(result.stdout).toContain(
        `Fetching profile "${profileId}" with version "${profileVersion}" from Superface registry`
      );
      expect(result.stdout).toContain(
        `Fetching map for profile "${profileId}@${profileVersion}" and provider "${provider}" with version "1.0.0" from Superface registry`
      );
      expect(result.stdout).toContain(
        `Provider "${provider}" found on local file system`
      );
      // Map and profile
      expect(result.stdout).toMatch(
        `🆗 Checking remote profile "${profileId}" with version "${profileVersion}" and remote map with version "1.0.0" for provider "${provider}"`
      );
      // Map and provider
      expect(result.stdout).toMatch(
        `🆗 Checking remote map with version "1.0.0" for profile "${profileId}" and local provider "${provider}" at path`
      );
      expect(result.stdout).toMatch(sourceFixture.provider);
    });

    it('checks capability with local map, profile and provider and --json flag', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
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
        ['check', '--profileId', profileId, '--providerName', provider, '-j '],
        mockServer.url
      );
      expect(result.stdout).toContain(
        `Profile "${profileId}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Map for profile "${profileId}" and provider "${provider}" found on local file system`
      );
      expect(result.stdout).toContain(
        `Provider "${provider}" found on local file system`
      );
      expect(result.stdout).toContain(JSON.stringify([]));
    });
  });
});
