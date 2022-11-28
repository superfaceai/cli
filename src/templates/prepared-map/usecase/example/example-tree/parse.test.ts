import {
  parseListLiteral,
  parseLiteralExample,
  parseObjectLiteral,
  parsePrimitiveLiteral,
} from './parse';

describe('Parse example tree', () => {
  describe('parseLiteralExample', () => {
    it('returns example object for object with ComlinkPrimitiveLiteral fields', () => {
      expect(
        parseLiteralExample({
          kind: 'ComlinkObjectLiteral',
          fields: [
            {
              kind: 'ComlinkAssignment',
              key: ['test', 'next'],
              value: {
                kind: 'ComlinkPrimitiveLiteral',
                value: false,
              },
            },
          ],
        })
      ).toEqual({
        kind: 'object',
        properties: [
          {
            name: 'test.next',
            kind: 'boolean',
            value: false,
          },
        ],
      });
    });

    it('returns example list for list with ComlinkPrimitiveLiteral fields', () => {
      expect(
        parseLiteralExample({
          kind: 'ComlinkListLiteral',
          items: [
            {
              kind: 'ComlinkPrimitiveLiteral',
              value: 'value',
            },
          ],
        })
      ).toEqual({
        kind: 'array',
        items: [
          {
            kind: 'string',
            value: 'value',
          },
        ],
      });
    });

    it('returns example scalar for ComlinkPrimitiveLiteral field', () => {
      expect(
        parseLiteralExample({
          kind: 'ComlinkPrimitiveLiteral',
          value: 'value',
        })
      ).toEqual({
        kind: 'string',
        value: 'value',
      });
    });
  });

  describe('parseListLiteral', () => {
    it('returns example array for object with ComlinkPrimitiveLiteral fields', () => {
      expect(
        parseListLiteral({
          kind: 'ComlinkListLiteral',
          items: [
            {
              kind: 'ComlinkPrimitiveLiteral',
              value: false,
            },
          ],
        })
      ).toEqual({
        kind: 'array',
        items: [
          {
            kind: 'boolean',
            value: false,
          },
        ],
      });
    });

    it('returns example array for object with ComlinkListLiteral fields', () => {
      expect(
        parseListLiteral({
          kind: 'ComlinkListLiteral',
          items: [
            {
              kind: 'ComlinkListLiteral',
              items: [
                {
                  kind: 'ComlinkPrimitiveLiteral',
                  value: 42,
                },
              ],
            },
          ],
        })
      ).toEqual({
        kind: 'array',
        items: [
          {
            kind: 'array',
            items: [
              {
                kind: 'number',
                value: 42,
              },
            ],
          },
        ],
      });
    });

    it('returns example array for object with ComlinkObjectLiteral fields', () => {
      expect(
        parseListLiteral({
          kind: 'ComlinkListLiteral',
          items: [
            {
              kind: 'ComlinkObjectLiteral',
              fields: [
                {
                  kind: 'ComlinkAssignment',
                  key: ['test', 'next'],
                  value: {
                    kind: 'ComlinkPrimitiveLiteral',
                    value: 'value',
                  },
                },
              ],
            },
          ],
        })
      ).toEqual({
        kind: 'array',
        items: [
          {
            kind: 'object',
            properties: [
              {
                name: 'test.next',
                kind: 'string',
                value: 'value',
              },
            ],
          },
        ],
      });
    });
  });

  describe('parseObjectLiteral', () => {
    it('returns example object for object with ComlinkPrimitiveLiteral fields', () => {
      expect(
        parseObjectLiteral({
          kind: 'ComlinkObjectLiteral',
          fields: [
            {
              kind: 'ComlinkAssignment',
              key: ['test', 'next'],
              value: {
                kind: 'ComlinkPrimitiveLiteral',
                value: false,
              },
            },
          ],
        })
      ).toEqual({
        kind: 'object',
        properties: [
          {
            name: 'test.next',
            kind: 'boolean',
            value: false,
          },
        ],
      });
    });

    it('returns object scalar for object with ComlinkListLiteral fields', () => {
      expect(
        parseObjectLiteral({
          kind: 'ComlinkObjectLiteral',
          fields: [
            {
              kind: 'ComlinkAssignment',
              key: ['test'],
              value: {
                kind: 'ComlinkListLiteral',
                items: [
                  {
                    kind: 'ComlinkPrimitiveLiteral',
                    value: 'value',
                  },
                ],
              },
            },
          ],
        })
      ).toEqual({
        kind: 'object',
        properties: [
          {
            name: 'test',
            kind: 'array',
            items: [
              {
                kind: 'string',
                value: 'value',
              },
            ],
          },
        ],
      });
    });

    it('returns example object for object with ComlinkObjectLiteralNode fields', () => {
      expect(
        parseObjectLiteral({
          kind: 'ComlinkObjectLiteral',
          fields: [
            {
              kind: 'ComlinkAssignment',
              key: ['test'],
              value: {
                kind: 'ComlinkObjectLiteral',
                fields: [
                  {
                    kind: 'ComlinkAssignment',
                    key: ['one'],
                    value: {
                      kind: 'ComlinkPrimitiveLiteral',
                      value: 42,
                    },
                  },
                ],
              },
            },
          ],
        })
      ).toEqual({
        kind: 'object',
        properties: [
          {
            name: 'test',
            kind: 'object',
            properties: [
              {
                name: 'one',
                kind: 'number',
                value: 42,
              },
            ],
          },
        ],
      });
    });
  });

  describe('parsePrimitiveLiteral', () => {
    it('returns example scalar for ComlinkPrimitiveLiteral', () => {
      expect(
        parsePrimitiveLiteral({
          kind: 'ComlinkPrimitiveLiteral',
          value: false,
        })
      ).toEqual({
        kind: 'boolean',
        value: false,
      });

      expect(
        parsePrimitiveLiteral({
          kind: 'ComlinkPrimitiveLiteral',
          value: 42,
        })
      ).toEqual({
        kind: 'number',
        value: 42,
      });

      expect(
        parsePrimitiveLiteral({
          kind: 'ComlinkPrimitiveLiteral',
          value: 'test',
        })
      ).toEqual({
        kind: 'string',
        value: 'test',
      });
    });
  });
});
