import { documentTypeFlag, skipFileFlag } from './flags';

describe('Custom flags', () => {
  describe('when creating document type flag', () => {
    it('creates document type flag', async () => {
      const flag = documentTypeFlag;
      expect(flag).toEqual({
        char: 't',
        default: 'auto',
        description:
          'Document type to parse. `auto` attempts to infer from file extension.',
        input: [],
        multiple: false,
        options: ['auto', 'map', 'profile'],
        parse: expect.anything(),
        type: 'option',
      });
      expect(flag.parse('auto', undefined)).toEqual('auto');
    });

    it('throws developer error on invalid input', async () => {
      expect(() => {
        documentTypeFlag.parse('invalid', undefined);
      }).toThrow('Internal error: unexpected enum variant');
    });
  });

  describe('when creating skip file flag', () => {
    it('creates skip file flag', async () => {
      const flag = skipFileFlag();
      expect(flag).toEqual({
        input: [],
        multiple: false,
        options: ['never', 'exists', 'always'],
        parse: expect.anything(),
        type: 'option',
      });
      expect(flag.parse('never', undefined)).toEqual('never');
    });

    it('throws developer error on invalid input', async () => {
      expect(() => {
        skipFileFlag().parse('invalid', undefined);
      }).toThrow('Internal error: unexpected enum variant');
    });
  });
});
