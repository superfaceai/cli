import { readFileSync } from 'fs';
import { stdout } from 'stdout-stderr';

import Transpile from './transpile';

describe('transpile CLI command', () => {


  beforeEach(() => {
    stdout.start();
  })

  afterEach(() => {
    stdout.stop();
  })

  describe('integration tests', () => {
    it('transpiles map', async () => {
      const mapASTFixture = JSON.parse(readFileSync('./fixtures/transpiled/testMap.suma.ast.json').toString()) as unknown;
      await Transpile.run(['./fixtures/testMap.suma']);

      expect(JSON.parse(stdout.output)).toEqual(mapASTFixture);
    });

    it('transpiles profile', async () => {
      const mapASTFixture = JSON.parse(readFileSync('./fixtures/transpiled/testProfile.supr.ast.json').toString()) as unknown;
      await Transpile.run(['./fixtures/testProfile.supr']);

      expect(JSON.parse(stdout.output)).toEqual(mapASTFixture);
    });
  });

});
