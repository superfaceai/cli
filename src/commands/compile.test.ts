import { stderr, stdout } from 'stdout-stderr';

import { readFilePromise } from '../common/io';
import Compile from './compile';

describe('Compile CLI command', () => {
  beforeEach(() => {
    stderr.start();
    stdout.start();
  });

  afterEach(() => {
    stderr.stop();
    stdout.stop();
  });

  describe('integration tests', () => {
    it('compiles map', async () => {
      const mapASTFixture = JSON.parse(
        (
          await readFilePromise('./fixtures/transpiled/testMap.suma.ast.json')
        ).toString()
      ) as unknown;
      await Compile.run(['./fixtures/testMap.suma', '-o', '-']);

      expect(JSON.parse(stdout.output)).toEqual(mapASTFixture);
    });

    it('compiles profile', async () => {
      const profileASTFixture = JSON.parse(
        (
          await readFilePromise(
            './fixtures/transpiled/testProfile.supr.ast.json'
          )
        ).toString()
      ) as unknown;
      await Compile.run(['./fixtures/testProfile.supr', '-o', '-2']);

      expect(JSON.parse(stderr.output)).toEqual(profileASTFixture);
    });

    it('compiles two files into one stream', async () => {
      const mapASTFixture = JSON.parse(
        (
          await readFilePromise('./fixtures/transpiled/testMap.suma.ast.json')
        ).toString()
      ) as unknown;
      const profileASTFixture = JSON.parse(
        (
          await readFilePromise(
            './fixtures/transpiled/testProfile.supr.ast.json'
          )
        ).toString()
      ) as unknown;

      await Compile.run([
        './fixtures/testMap.suma',
        './fixtures/testProfile.supr',
        '-o',
        '-',
      ]);

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
});
