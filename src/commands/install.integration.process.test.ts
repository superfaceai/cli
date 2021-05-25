import { SuperJson } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import { join as joinPath } from 'path';

import { exists, mkdir, readFile, rimraf } from '../common/io';
import { execCLI, mockResponsesForProfile, setUpTempDir } from '../test/utils';

const mockServer = getLocal();

describe('Install CLI command', () => {
  const TEMP_PATH = joinPath('test', 'tmp');

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
    await mockServer.start();
    await mockResponsesForProfile(mockServer, 'starwars/character-information');
    await mockResponsesForProfile(
      mockServer,
      'starwars/character-information@1.0.2'
    );
  });

  afterAll(async () => {
    await mockServer.stop();
    await rimraf(TEMP_PATH);
  });

  describe('when installing new profile', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await setUpTempDir(TEMP_PATH);
    });

    it('installs the newest profile', async () => {
      const paths = [
        joinPath(
          tempDir,
          'superface',
          'types',
          'starwars',
          'character-information' + '.js'
        ),
        joinPath(
          tempDir,
          'superface',
          'types',
          'starwars',
          'character-information' + '.d.ts'
        ),
        joinPath(tempDir, 'superface', 'sdk.js'),
        joinPath(tempDir, 'superface', 'sdk.d.ts'),
      ];
      expect(await exists(paths[0])).toBe(false);
      expect(await exists(paths[1])).toBe(false);
      expect(await exists(paths[2])).toBe(false);
      expect(await exists(paths[3])).toBe(false);

      const result = await execCLI(
        tempDir,
        ['install', 'starwars/character-information'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );
      expect(await exists(joinPath(tempDir, 'superface', 'super.json'))).toBe(
        true
      );
      expect(
        await exists(
          joinPath(
            tempDir,
            'superface',
            'grid',
            'starwars',
            'character-information@1.0.1.supr'
          )
        )
      ).toBe(true);

      expect(await exists(paths[0])).toBe(true);
      expect(await exists(paths[1])).toBe(true);
      expect(await exists(paths[2])).toBe(true);
      expect(await exists(paths[3])).toBe(true);
    }, 20000);

    it('installs the specified profile version with default provider configuration', async () => {
      const result = await execCLI(
        tempDir,
        ['install', 'starwars/character-information@1.0.2'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );
      expect(await exists(joinPath(tempDir, 'superface', 'super.json'))).toBe(
        true
      );
      expect(
        await exists(
          joinPath(
            tempDir,
            'superface',
            'grid',
            'starwars',
            'character-information@1.0.2.supr'
          )
        )
      ).toBe(true);
    }, 20000);

    it('installs local profile', async () => {
      const profileId = 'starwars/character-information';
      const profileIdRequest =
        '../../../fixtures/profiles/starwars/character-information.supr';

      const result = await execCLI(
        tempDir,
        ['install', profileIdRequest, '--local'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );
      expect(await exists(joinPath(tempDir, 'superface', 'super.json'))).toBe(
        true
      );

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document.profiles![profileId]).toEqual({
        file: `../${profileIdRequest}`,
      });
    }, 20000);

    it('adds new typings to previously generated', async () => {
      const profileId = 'starwars/character-information';
      const anotherProfileId = 'starwars/spaceship-information';
      const profileIdRequest =
        '../../../fixtures/profiles/starwars/spaceship-information.supr';

      const paths = [
        joinPath(tempDir, 'superface', 'types', profileId + '.js'),
        joinPath(tempDir, 'superface', 'types', profileId + '.d.ts'),
        joinPath(tempDir, 'superface', 'sdk.js'),
        joinPath(tempDir, 'superface', 'sdk.d.ts'),
        joinPath(tempDir, 'superface', 'types', anotherProfileId + '.js'),
        joinPath(tempDir, 'superface', 'types', anotherProfileId + '.d.ts'),
      ];
      expect(await exists(paths[0])).toBe(false);
      expect(await exists(paths[1])).toBe(false);
      expect(await exists(paths[2])).toBe(false);
      expect(await exists(paths[3])).toBe(false);
      expect(await exists(paths[4])).toBe(false);
      expect(await exists(paths[5])).toBe(false);

      let result = await execCLI(
        tempDir,
        ['install', 'starwars/character-information'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );

      expect(await exists(paths[0])).toBe(true);
      expect(await exists(paths[1])).toBe(true);
      expect(await exists(paths[2])).toBe(true);
      expect(await exists(paths[3])).toBe(true);
      expect(await exists(paths[4])).toBe(false);
      expect(await exists(paths[5])).toBe(false);

      result = await execCLI(
        tempDir,
        ['install', profileIdRequest, '--local'],
        mockServer.url
      );
      expect(result.stdout).toMatch(
        'All profiles (1) have been installed successfully.'
      );

      expect(await exists(paths[0])).toBe(true);
      expect(await exists(paths[1])).toBe(true);
      expect(await exists(paths[2])).toBe(true);
      expect(await exists(paths[3])).toBe(true);
      expect(await exists(paths[4])).toBe(true);
      expect(await exists(paths[5])).toBe(true);

      const sdk = (await readFile(paths[2])).toString();

      expect(sdk).toMatch(/starwarsCharacterInformation/);
      expect(sdk).toMatch(/starwarsSpaceshipInformation/);
    }, 50000);

    it('error when installing non-existent local profile', async () => {
      const profileIdRequest = 'none.supr';

      const result = await execCLI(
        tempDir,
        ['install', profileIdRequest, '--local'],
        mockServer.url
      );
      expect(result.stdout).toMatch('❌ No profiles have been installed');
      expect(await exists(joinPath(tempDir, 'superface', 'super.json'))).toBe(
        true
      );

      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();

      expect(superJson.document.profiles).toStrictEqual({});
    }, 20000);

    describe('when local files are present', () => {
      it('errors without a force flag', async () => {
        const profileId = 'starwars/character-information';
        const profileIdRequest =
          '../../../fixtures/profiles/starwars/character-information.supr';

        let result = await execCLI(
          tempDir,
          ['install', profileIdRequest, '--local'],
          mockServer.url
        );
        expect(result.stdout).toMatch(
          'All profiles (1) have been installed successfully.'
        );
        expect(await exists(joinPath(tempDir, 'superface', 'super.json'))).toBe(
          true
        );

        result = await execCLI(tempDir, ['install', profileId], mockServer.url);
        expect(result.stdout).toMatch('⚠️  File already exists');

        expect(result.stdout).toMatch('❌ No profiles have been installed');
      }, 20000);
    });
  });
});
