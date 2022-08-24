import { getLocal } from 'mockttp';
import { join as joinPath } from 'path';

import { exists, mkdir, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { execCLI, mockResponsesForProfile, setUpTempDir } from '../test/utils';

const mockServer = getLocal();

describe('Generate CLI command', () => {
  // File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  let tempDir: string;
  const firstProfileId = 'starwars/character-information';
  const secondProfileId = 'communication/send-email';
  const firstProfileVersion = '1.0.2';

  const sourceFixture = {
    firstProfile: joinPath(
      'fixtures',
      'profiles',
      'starwars',
      'character-information.supr'
    ),
    secondProfile: joinPath(
      'fixtures',
      'profiles',
      'communication',
      'send-email@1.0.1.supr'
    ),
  };

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
    await mockServer.start();
    await mockResponsesForProfile(mockServer, 'starwars/character-information');
    await mockResponsesForProfile(
      mockServer,
      'starwars/character-information@1.0.2'
    );

    await mockResponsesForProfile(mockServer, 'communication/send-email@1.0.1');
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

  describe('when generating types', () => {
    it('generates types for specific local profile', async () => {
      const mockSuperJson = {
        profiles: {
          [firstProfileId]: {
            file: `../../../../${sourceFixture.firstProfile}`,
            providers: {},
          },
        },
        providers: {},
      };

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        JSON.stringify(mockSuperJson, undefined, 2)
      );
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
      await expect(exists(paths[0])).resolves.toBe(false);
      await expect(exists(paths[1])).resolves.toBe(false);
      await expect(exists(paths[2])).resolves.toBe(false);
      await expect(exists(paths[3])).resolves.toBe(false);

      const result = await execCLI(
        tempDir,
        ['generate', '--profileId', 'starwars/character-information'],
        mockServer.url
      );
      expect(result.stdout).toMatch('🆗 types generated successfully');

      await expect(exists(paths[0])).resolves.toBe(true);
      await expect(exists(paths[1])).resolves.toBe(true);
      await expect(exists(paths[2])).resolves.toBe(true);
      await expect(exists(paths[3])).resolves.toBe(true);
    }, 30000);

    it('generates types for specific remote profile', async () => {
      const mockSuperJson = {
        profiles: {
          [firstProfileId]: {
            version: firstProfileVersion,
            providers: {},
          },
        },
        providers: {},
      };

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        JSON.stringify(mockSuperJson, undefined, 2)
      );
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
      await expect(exists(paths[0])).resolves.toBe(false);
      await expect(exists(paths[1])).resolves.toBe(false);
      await expect(exists(paths[2])).resolves.toBe(false);
      await expect(exists(paths[3])).resolves.toBe(false);

      const result = await execCLI(
        tempDir,
        ['generate', '--profileId', 'starwars/character-information'],
        mockServer.url
      );
      expect(result.stdout).toMatch('🆗 types generated successfully');

      await expect(exists(paths[0])).resolves.toBe(true);
      await expect(exists(paths[1])).resolves.toBe(true);
      await expect(exists(paths[2])).resolves.toBe(true);
      await expect(exists(paths[3])).resolves.toBe(true);
    }, 30000);

    it('generates types for super.json with remote and local profile', async () => {
      const mockSuperJson = {
        profiles: {
          [firstProfileId]: {
            version: firstProfileVersion,
            providers: {},
          },
          [secondProfileId]: {
            file: `../../../../${sourceFixture.secondProfile}`,
          },
        },
        providers: {},
      };

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        JSON.stringify(mockSuperJson, undefined, 2)
      );
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
        joinPath(
          tempDir,
          'superface',
          'types',
          'communication',
          'send-email' + '.js'
        ),
        joinPath(
          tempDir,
          'superface',
          'types',
          'communication',
          'send-email' + '.d.ts'
        ),
        joinPath(tempDir, 'superface', 'sdk.js'),
        joinPath(tempDir, 'superface', 'sdk.d.ts'),
      ];
      await expect(exists(paths[0])).resolves.toBe(false);
      await expect(exists(paths[1])).resolves.toBe(false);
      await expect(exists(paths[2])).resolves.toBe(false);
      await expect(exists(paths[3])).resolves.toBe(false);
      await expect(exists(paths[4])).resolves.toBe(false);
      await expect(exists(paths[5])).resolves.toBe(false);

      const result = await execCLI(tempDir, ['generate'], mockServer.url);
      expect(result.stdout).toMatch('🆗 types generated successfully');

      await expect(exists(paths[0])).resolves.toBe(true);
      await expect(exists(paths[1])).resolves.toBe(true);
      await expect(exists(paths[2])).resolves.toBe(true);
      await expect(exists(paths[3])).resolves.toBe(true);
    }, 30000);
  });
});
