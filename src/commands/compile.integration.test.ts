import { EXTENSIONS } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { promises as fsp } from 'fs';
import { join as joinPath, resolve } from 'path';

import { exists, mkdir, readFile, rimraf, stat } from '../common/io';
import { OutputStream } from '../common/output-stream';
// import { MockStd, mockStd } from '../test/mock-std';
import { execCLI, setUpTempDir } from '../test/utils';

describe('Compile CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  const profileId = 'starwars/character-information';
  const profileVersion = '1.0.1';
  const provider = 'swapi';
  let tempDir: string;

  // const compileDir = joinPath('fixtures', 'compile');
  const fixture = {
    strictProfile: joinPath('fixtures', 'strict.supr'),
    strictMap: joinPath('fixtures', 'strict.suma'),
    strictProfileAst: joinPath('fixtures', 'compiled', 'strict.supr.ast.json'),
    strictMapAst: joinPath('fixtures', 'compiled', 'strict.suma.ast.json'),
  };

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
  });

  beforeEach(async () => {
    tempDir = await setUpTempDir(TEMP_PATH);
  });

  afterEach(async () => {
    await rimraf(tempDir);
  });

  describe('integration tests', () => {
    it('compiles map', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: profileVersion,
            providers: {
              [provider]: {
                file: `../../../../${fixture.strictMap}`,
              },
            },
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
          'compile',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '--map',
        ],
        ''
      );
      //Check stdout
      expect(result.stdout).toContain(
        `Compiling map for profile: "${profileId}" and provider: "${provider}".`
      );
      expect(result.stdout).toContain(
        `🆗 map for profile: "${profileId}" and provider: "${provider}" compiled successfully.`
      );

      expect(result.stdout).not.toContain(`Compiling profile: "${profileId}".`);
      expect(result.stdout).not.toContain(
        `🆗 profile: "${profileId}" compiled successfully.`
      );

      //Check super.json
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();
      expect(superJson.normalized).toEqual(mockSuperJson.normalized);

      //Check output file
      const mapASTFixture = JSON.parse(
        await readFile(fixture.strictMapAst, { encoding: 'utf-8' })
      ) as unknown;

      const outputDir = resolve(
        joinPath(tempDir, 'superface', '.cache', profileId)
      );
      await expect(exists(outputDir)).resolves.toEqual(true);
      expect((await stat(outputDir)).isDirectory()).toEqual(true);

      const outputFiles = await fsp.readdir(outputDir);
      expect(outputFiles.length).toEqual(1);
      expect(outputFiles[0]).toContain(provider);
      expect(outputFiles[0]).toContain(EXTENSIONS.map.build);

      expect(
        JSON.parse(
          await readFile(joinPath(outputDir, outputFiles[0]), {
            encoding: 'utf-8',
          })
        )
      ).toEqual(mapASTFixture);
    }, 10000);

    it('compiles profile', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: `../../../../${fixture.strictProfile}`,
            providers: {
              [provider]: {
                file: `../../../../${fixture.strictMap}`,
              },
            },
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
        ['compile', '--profileId', profileId, '--profile'],
        ''
      );
      //Check stdout
      expect(result.stdout).not.toContain(
        `Compiling map for profile: "${profileId}" and provider: "${provider}".`
      );
      expect(result.stdout).not.toContain(
        `🆗 map for profile: "${profileId}" and provider: "${provider}" compiled successfully.`
      );

      expect(result.stdout).toContain(`Compiling profile: "${profileId}".`);
      expect(result.stdout).toContain(
        `🆗 profile: "${profileId}" compiled successfully.`
      );

      //Check super.json
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();
      expect(superJson.normalized).toEqual(mockSuperJson.normalized);

      //Check output file
      const profileASTFixture = JSON.parse(
        await readFile(fixture.strictProfileAst, { encoding: 'utf-8' })
      ) as unknown;

      const outputDir = resolve(
        joinPath(tempDir, 'superface', '.cache', 'starwars')
      );
      await expect(exists(outputDir)).resolves.toEqual(true);
      expect((await stat(outputDir)).isDirectory()).toEqual(true);

      const outputFiles = await fsp.readdir(outputDir);
      expect(outputFiles.length).toEqual(1);
      expect(outputFiles[0]).toContain('character-information');
      expect(outputFiles[0]).toContain(EXTENSIONS.profile.build);

      expect(
        JSON.parse(
          await readFile(joinPath(outputDir, outputFiles[0]), {
            encoding: 'utf-8',
          })
        )
      ).toEqual(profileASTFixture);
    }, 10000);

    it('compiles profile and map', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: `../../../../${fixture.strictProfile}`,
            providers: {
              [provider]: {
                file: `../../../../${fixture.strictMap}`,
              },
            },
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
          'compile',
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '--map',
          '--profile',
        ],
        ''
      );
      //Check stdout
      expect(result.stdout).toContain(
        `Compiling map for profile: "${profileId}" and provider: "${provider}".`
      );
      expect(result.stdout).toContain(
        `🆗 map for profile: "${profileId}" and provider: "${provider}" compiled successfully.`
      );
      expect(result.stdout).toContain(`Compiling profile: "${profileId}".`);
      expect(result.stdout).toContain(
        `🆗 profile: "${profileId}" compiled successfully.`
      );

      //Check super.json
      const superJson = (
        await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))
      ).unwrap();
      expect(superJson.normalized).toEqual(mockSuperJson.normalized);

      //Check output files
      const profileASTFixture = JSON.parse(
        await readFile(fixture.strictProfileAst, { encoding: 'utf-8' })
      ) as unknown;

      const mapASTFixture = JSON.parse(
        await readFile(fixture.strictMapAst, { encoding: 'utf-8' })
      ) as unknown;

      const outputDir = resolve(
        joinPath(tempDir, 'superface', '.cache', 'starwars')
      );
      await expect(exists(outputDir)).resolves.toEqual(true);
      expect((await stat(outputDir)).isDirectory()).toEqual(true);

      let outputFiles = await fsp.readdir(outputDir);
      expect(outputFiles.length).toEqual(2);
      //There is a profile file and folder for maps
      expect(
        outputFiles.some(file => file === 'character-information')
      ).toEqual(true);
      expect(
        outputFiles.some(
          file =>
            file.includes('character-information') &&
            file.endsWith(EXTENSIONS.profile.build)
        )
      ).toEqual(true);
      expect(
        JSON.parse(
          await readFile(
            joinPath(
              outputDir,
              outputFiles.filter(file =>
                file.endsWith(EXTENSIONS.profile.build)
              )[0]
            ),
            { encoding: 'utf-8' }
          )
        )
      ).toEqual(profileASTFixture);

      //There is a map file
      const mapOutputDir = joinPath(outputDir, 'character-information');
      await expect(exists(mapOutputDir)).resolves.toEqual(true);
      outputFiles = await fsp.readdir(mapOutputDir);
      expect(outputFiles.length).toEqual(1);
      expect(
        JSON.parse(
          await readFile(joinPath(mapOutputDir, outputFiles[0]), {
            encoding: 'utf-8',
          })
        )
      ).toEqual(mapASTFixture);
    }, 10000);
  });
});
