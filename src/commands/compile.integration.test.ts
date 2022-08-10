import {
  loadSuperJson,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { exists, mkdir, readFile } from '../common/io';
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

  let mapAstFixture: unknown, profileAstFixture: unknown;

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });

    mapAstFixture = JSON.parse(
      await readFile(fixture.strictMapAst, { encoding: 'utf-8' })
    ) as unknown;

    profileAstFixture = JSON.parse(
      await readFile(fixture.strictProfileAst, { encoding: 'utf-8' })
    ) as unknown;
  });

  beforeEach(async () => {
    tempDir = await setUpTempDir(TEMP_PATH);
  });

  afterEach(async () => {
    //await rimraf(tempDir);
  });

  describe('integration tests', () => {
    it('compiles all', async () => {
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: '../profile.supr',
            providers: {
              [provider]: {
                file: '../map.suma',
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
      //Copy profile source
      await OutputStream.writeOnce(
        joinPath(tempDir, 'profile.supr'),
        await readFile(fixture.strictProfile, { encoding: 'utf-8' })
      );
      //Copy map source
      await OutputStream.writeOnce(
        joinPath(tempDir, 'map.suma'),
        await readFile(fixture.strictMap, { encoding: 'utf-8' })
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

      //Check output files
      await expect(
        exists(joinPath(tempDir, 'profile.supr.ast.json'))
      ).resolves.toEqual(true);
      await expect(
        exists(joinPath(tempDir, 'map.suma.ast.json'))
      ).resolves.toEqual(true);

      expect(
        JSON.parse(
          await readFile(joinPath(tempDir, 'map.suma.ast.json'), {
            encoding: 'utf-8',
          })
        )
      ).toEqual(mapAstFixture);

      expect(
        JSON.parse(
          await readFile(joinPath(tempDir, 'profile.supr.ast.json'), {
            encoding: 'utf-8',
          })
        )
      ).toEqual(profileAstFixture);
    }, 10000);

    it('compiles single profile and its maps', async () => {
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: '../profile.supr',
            providers: {
              [provider]: {
                file: '../map.suma',
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

      //Copy profile source
      await OutputStream.writeOnce(
        joinPath(tempDir, 'profile.supr'),
        await readFile(fixture.strictProfile, { encoding: 'utf-8' })
      );
      //Copy map source
      await OutputStream.writeOnce(
        joinPath(tempDir, 'map.suma'),
        await readFile(fixture.strictMap, { encoding: 'utf-8' })
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

      //Check output files
      await expect(
        exists(joinPath(tempDir, 'profile.supr.ast.json'))
      ).resolves.toEqual(true);
      await expect(
        exists(joinPath(tempDir, 'map.suma.ast.json'))
      ).resolves.toEqual(true);

      expect(
        JSON.parse(
          await readFile(joinPath(tempDir, 'map.suma.ast.json'), {
            encoding: 'utf-8',
          })
        )
      ).toEqual(mapAstFixture);

      expect(
        JSON.parse(
          await readFile(joinPath(tempDir, 'profile.supr.ast.json'), {
            encoding: 'utf-8',
          })
        )
      ).toEqual(profileAstFixture);
    }, 10000);

    it('compiles single profile and single map', async () => {
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: '../profile.supr',
            providers: {
              [provider]: {
                file: '../map.suma',
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

      //Copy profile source
      await OutputStream.writeOnce(
        joinPath(tempDir, 'profile.supr'),
        await readFile(fixture.strictProfile, { encoding: 'utf-8' })
      );
      //Copy map source
      await OutputStream.writeOnce(
        joinPath(tempDir, 'map.suma'),
        await readFile(fixture.strictMap, { encoding: 'utf-8' })
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
      await expect(
        exists(joinPath(tempDir, 'profile.supr.ast.json'))
      ).resolves.toEqual(true);
      await expect(
        exists(joinPath(tempDir, 'map.suma.ast.json'))
      ).resolves.toEqual(true);

      expect(
        JSON.parse(
          await readFile(joinPath(tempDir, 'map.suma.ast.json'), {
            encoding: 'utf-8',
          })
        )
      ).toEqual(mapAstFixture);

      expect(
        JSON.parse(
          await readFile(joinPath(tempDir, 'profile.supr.ast.json'), {
            encoding: 'utf-8',
          })
        )
      ).toEqual(profileAstFixture);
    }, 10000);
  });
});
