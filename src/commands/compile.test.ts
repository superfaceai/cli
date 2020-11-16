import { readFileSync } from 'fs';
import { stdout } from 'stdout-stderr';

import Compile from './compile';

describe('Compile CLI command', () => {


  beforeEach(() => {
    stdout.start();
  })

  afterEach(() => {
    stdout.stop();
  })

  describe('integration tests', () => {
    it('compiles map', async () => {
      const mapASTFixture = JSON.parse(readFileSync('./fixtures/transpiled/testMap.suma.ast.json').toString()) as unknown;
      await Compile.run(['./fixtures/testMap.suma', "-o", "-"]);

      expect(JSON.parse(stdout.output)).toEqual(mapASTFixture);
    });

    it('compiles profile', async () => {
      const mapASTFixture = JSON.parse(readFileSync('./fixtures/transpiled/testProfile.supr.ast.json').toString()) as unknown;
      await Compile.run(["./fixtures/testProfile.supr", "-o", "-"]);

      expect(JSON.parse(stdout.output)).toEqual(mapASTFixture);
    });
  });

});
