import * as nodePath from 'path';
import { stderr, stdout } from 'stdout-stderr';

import { access, mkdir, readFile, rimraf } from '../common/io';
import Compile from './compile';

describe('Compile CLI command', () => {
  const compileDir = nodePath.join('fixtures', 'compile');
  const fixture = {
    strictProfile: nodePath.join('fixtures', 'strict.supr'),
    strictMap: nodePath.join('fixtures', 'strict.suma'),
    strictProfileAst: nodePath.join(
      'fixtures',
      'compiled',
      'strict.supr.ast.json'
    ),
    strictMapAst: nodePath.join('fixtures', 'compiled', 'strict.suma.ast.json'),
  };

  beforeEach(() => {
    stderr.start();
    stdout.start();
  });

  afterEach(async () => {
    stderr.stop();
    stdout.stop();

    await rimraf(compileDir);
  });

  describe('integration tests', () => {
    it('compiles map', async () => {
      const mapASTFixture = JSON.parse(
        (await readFile(fixture.strictMapAst)).toString()
      ) as unknown;
      await Compile.run([fixture.strictMap, '-o', '-']);

      expect(JSON.parse(stdout.output)).toEqual(mapASTFixture);
    });

    it('compiles profile', async () => {
      const profileASTFixture = JSON.parse(
        (await readFile(fixture.strictProfileAst)).toString()
      ) as unknown;
      await Compile.run([fixture.strictProfile, '-o', '-2']);

      expect(JSON.parse(stderr.output)).toEqual(profileASTFixture);
    });

    it('compiles two files into one stream', async () => {
      const mapASTFixture = JSON.parse(
        (await readFile(fixture.strictMapAst)).toString()
      ) as unknown;
      const profileASTFixture = JSON.parse(
        (await readFile(fixture.strictProfileAst)).toString()
      ) as unknown;

      await Compile.run([fixture.strictMap, fixture.strictProfile, '-o', '-']);

      const output = stdout.output;
      const fileBoundary = output.indexOf('}{');
      expect(fileBoundary).toBeGreaterThan(0);

      const firstFile = JSON.parse(
        output.slice(0, fileBoundary + 1)
      ) as unknown;
      const secondFile = JSON.parse(output.slice(fileBoundary + 1)) as unknown;
      const files = [firstFile, secondFile];

      expect(files).toContainEqual(mapASTFixture);
      expect(files).toContainEqual(profileASTFixture);
    });
  });

  it('compiles to outdir', async () => {
    await mkdir(compileDir);

    await Compile.run([
      fixture.strictProfile,
      fixture.strictMap,
      '-o',
      compileDir,
    ]);

    const expectedFiles = [
      nodePath.join(compileDir, 'strict.supr.ast.json'),
      nodePath.join(compileDir, 'strict.suma.ast.json'),
    ];

    await Promise.all(
      expectedFiles.map(f => expect(access(f)).resolves.toBeUndefined())
    );
  });
});
