import { EXTENSIONS } from '@superfaceai/ast';
import {
  loadSuperJson,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import { promises as fsp } from 'fs';
import { join as joinPath, resolve } from 'path';

import { exists, mkdir, readFile, rimraf, stat } from '../common/io';
import { messages } from '../common/messages';
import { OutputStream } from '../common/output-stream';
import { execCLI, setUpTempDir } from '../test/utils';

describe('Compile CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  const profileId = 'starwars/character-information';
  const provider = 'swapi';
  let tempDir: string;

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
    it('compiles all', async () => {
      const mockSuperJson = {
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
      };

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        JSON.stringify(mockSuperJson, undefined, 2)
      );
      const result = await execCLI(tempDir, ['compile'], '');
      //Check stdout
      expect(result.stdout).toMatch(messages.compileMap(profileId, provider));

      expect(result.stdout).toContain(messages.compileProfile(profileId));

      expect(result.stdout).toContain(messages.compiledSuccessfully());

      //Check super.json
      const superJson = (
        await loadSuperJson(
          joinPath(tempDir, 'superface', 'super.json'),
          NodeFileSystem
        )
      ).unwrap();
      expect(normalizeSuperJsonDocument(superJson)).toEqual(
        normalizeSuperJsonDocument(mockSuperJson)
      );

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

    it('compiles single profile and its maps', async () => {
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: `../../../../${fixture.strictProfile}`,
            providers: {
              [provider]: {
                file: `../../../../${fixture.strictMap}`,
              },
            },
          },
          other: {
            version: '1.0.0',
            providers: {},
          },
        },
      };

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        JSON.stringify(mockSuperJson, undefined, 2)
      );
      const result = await execCLI(
        tempDir,
        ['compile', '--profileId', profileId],
        '',
        { debug: true }
      );
      //Check stdout
      expect(result.stdout).toMatch(messages.compileMap(profileId, provider));

      expect(result.stdout).toContain(messages.compileProfile(profileId));

      expect(result.stdout).toContain(messages.compiledSuccessfully());

      //Check super.json
      const superJson = (
        await loadSuperJson(
          joinPath(tempDir, 'superface', 'super.json'),
          NodeFileSystem
        )
      ).unwrap();
      expect(normalizeSuperJsonDocument(superJson)).toEqual(
        normalizeSuperJsonDocument(mockSuperJson)
      );

      //Check output file

      const outputDir = resolve(
        joinPath(tempDir, 'superface', '.cache', 'starwars')
      );
      await expect(exists(outputDir)).resolves.toEqual(true);
      expect((await stat(outputDir)).isDirectory()).toEqual(true);

      const outputFiles = await fsp.readdir(outputDir);
      expect(outputFiles.length).toEqual(2);
      //Map
      const mapASTFixture = JSON.parse(
        await readFile(fixture.strictMapAst, { encoding: 'utf-8' })
      ) as unknown;

      expect(outputFiles[0]).toContain('character-information');
      expect(
        (await stat(joinPath(outputDir, outputFiles[0]))).isDirectory()
      ).toEqual(true);

      const mapFiles = await fsp.readdir(joinPath(outputDir, outputFiles[0]));
      expect(mapFiles.length).toEqual(1);
      expect(
        JSON.parse(
          await readFile(joinPath(outputDir, outputFiles[0], mapFiles[0]), {
            encoding: 'utf-8',
          })
        )
      ).toEqual(mapASTFixture);

      //Profile
      const profileASTFixture = JSON.parse(
        await readFile(fixture.strictProfileAst, { encoding: 'utf-8' })
      ) as unknown;
      expect(outputFiles[1]).toContain(EXTENSIONS.profile.build);

      expect(
        JSON.parse(
          await readFile(joinPath(outputDir, outputFiles[1]), {
            encoding: 'utf-8',
          })
        )
      ).toEqual(profileASTFixture);
    }, 10000);

    it('compiles single profile and single map', async () => {
      const mockSuperJson = {
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
      };

      await mkdir(joinPath(tempDir, 'superface'));
      await OutputStream.writeOnce(
        joinPath(tempDir, 'superface', 'super.json'),
        JSON.stringify(mockSuperJson, undefined, 2)
      );
      const result = await execCLI(
        tempDir,
        ['compile', '--profileId', profileId, '--providerName', provider],
        ''
      );
      //Check stdout
      expect(result.stdout).toMatch(messages.compileMap(profileId, provider));

      expect(result.stdout).toContain(messages.compileProfile(profileId));

      expect(result.stdout).toContain(messages.compiledSuccessfully());

      //Check super.json
      const superJson = (
        await loadSuperJson(
          joinPath(tempDir, 'superface', 'super.json'),
          NodeFileSystem
        )
      ).unwrap();
      expect(normalizeSuperJsonDocument(superJson)).toEqual(
        normalizeSuperJsonDocument(mockSuperJson)
      );

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
