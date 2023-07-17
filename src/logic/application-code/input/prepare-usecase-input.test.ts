import { parseProfile, Source } from '@superfaceai/parser';

import { SupportedLanguages } from '../application-code';
import { prepareUseCaseInput } from './prepare-usecase-input';

describe('prepareUseCaseInput', () => {
  const mockProfileSource = `name = "test"
version = "0.0.0"

usecase Test safe {

  example InputExample {
    input {
      a = 'Luke',
      b = 1.2,
      c = true,
      d = [1],
      e = ['a', 'b'],
      f = [true, false],
      g = { a = 1, b = 2 },
      h = { a = 'a', b = 'b' },
      i = { a = true, b = false },
      k = { a = [{ b = [ true]}] },
    }
  }
}`;

  const ast = parseProfile(new Source(mockProfileSource, 'test.supr'));

  describe('for js', () => {
    it('should prepare input for use case', () => {
      const input = prepareUseCaseInput(ast, SupportedLanguages.JS);
      expect(input).toEqual(`{
        a : 'Luke',
        b: 1.2,
        c: true,
        d: [
          1,
        ],
        e: [
          'a',
          'b',
        ],
        f: [
          true,
          false,
        ],
        g: {
          a: 1,
          b: 2,
        },
        h: {
          a : 'a',
          b : 'b',
        },
        i: {
          a: true,
          b: false,
        },
        k: {
          a: [
            {
              b: [
                true,
              ],
            },
          ],
        },
      }`);
    });
  });

  describe('for python', () => {
    it('should prepare input for use case', () => {
      const input = prepareUseCaseInput(ast, SupportedLanguages.PYTHON);
      expect(input).toEqual(`{
        "a" : 'Luke',
        "b": 1.2,
        "c": True,
        "d": [
          1,
        ],
        "e": [
          'a',
          'b',
        ],
        "f": [
          True,
          False,
        ],
        "g": {
          "a": 1,
          "b": 2,
        },
        "h": {
          "a" : 'a',
          "b" : 'b',
        },
        "i": {
          "a": True,
          "b": False,
        },
        "k": {
          "a": [
            {
              "b": [
                True,
              ],
            },
          ],
        },
      }`);
    });
  });
});
