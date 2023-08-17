import { parseProfile, Source } from '@superfaceai/parser';

import { SupportedLanguages } from '../application-code';
import { prepareUseCaseInput } from './prepare-usecase-input';

describe('prepareUseCaseInput', () => {
  const mockProfileSource = `name = "test"
    version = "0.0.0"

    usecase Test safe {

      input {
        a! string!
        b! number
        c! boolean
        d! [number]
        e [string!]!
        f! [boolean]
        g! {
          a number
          b number
        }!
        h {
          a string
          b string
        }
        i {
          a boolean
          b boolean
        }!
        j! [{
          k! string
          m {
            n! number
          }
        }]
        l {
          a [{
            b [boolean]
            c! {
              d! number
            }
          }]
        }
        fieldA!
        fieldB!
        fieldC!
        fieldD!

        r modelA!
      }
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
          j = [{ k = 'a', m = { n = 1 } }],
          l = { a = [{ b = [ true ], c = { d = 12 }}] },
          fieldA = 'a',
          fieldB = 1,
          fieldC = true,
          fieldD = "A",
          r = { a = 'a' }
        }
      }
    }

  field fieldA string!
  field fieldB number
  field fieldC boolean
  field fieldD enum {
    A
    B
  }

  model modelA {
   a string!
  }`;

  const ast = parseProfile(new Source(mockProfileSource, 'test.supr'));

  describe('for js', () => {
    it('should prepare input for use case', () => {
      const input = prepareUseCaseInput(ast, SupportedLanguages.JS);
      expect(input).toEqual(`{
        a: 'Luke'//Required,
        b: 1.2//Required,
        c: true//Required,
        d: [
          1,
        ]//Required,
        e: [
          'a',
          'b',
        ],
        f: [
          true,
          false,
        ]//Required,
        g: {
          a: 1,
          b: 2,
        },
        h: {
          a: 'a',
          b: 'b',
        },
        i: {
          a: true,
          b: false,
        },
        j: [
          {
            k: 'a'//Required,
            m: {
              n: 1//Required,
            },
          },
        ]//Required,
        l: {
          a: [
            {
              b: [
                true,
              ],
              c: {
                d: 12//Required,
              },
            },
          ],
        },
        fieldA: 'a'//Required,
        fieldB: 1//Required,
        fieldC: true//Required,
        fieldD: 'A'//Required,
        r: {
          a: 'a',
        },
      }`);
    });
  });

  describe('for python', () => {
    it('should prepare input for use case', () => {
      const input = prepareUseCaseInput(ast, SupportedLanguages.PYTHON);
      expect(input).toEqual(`{
        "a": 'Luke'#Required,
        "b": 1.2#Required,
        "c": True#Required,
        "d": [
          1,
        ]#Required,
        "e": [
          'a',
          'b',
        ],
        "f": [
          True,
          False,
        ]#Required,
        "g": {
          "a": 1,
          "b": 2,
        },
        "h": {
          "a": 'a',
          "b": 'b',
        },
        "i": {
          "a": True,
          "b": False,
        },
        "j": [
          {
            "k": 'a'#Required,
            "m": {
              "n": 1#Required,
            },
          },
        ]#Required,
        "l": {
          "a": [
            {
              "b": [
                True,
              ],
              "c": {
                "d": 12#Required,
              },
            },
          ],
        },
        "fieldA": 'a'#Required,
        "fieldB": 1#Required,
        "fieldC": True#Required,
        "fieldD": 'A'#Required,
        "r": {
          "a": 'a',
        },
      }`);
    });
  });
});
