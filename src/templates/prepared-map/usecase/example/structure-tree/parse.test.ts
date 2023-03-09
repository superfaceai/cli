import {
  visit,
  visitEnumNode,
  visitListNode,
  visitObjecDefinition,
  visitPrimitiveNode,
} from './parse';

describe('Parse structure tree', () => {
  describe('visit', () => {
    it('throws when type is not defined', () => {
      expect(() =>
        visit(
          {
            kind: 'ComlinkPrimitiveLiteral',
            value: '',
          },
          {},
          {}
        )
      ).toThrowError(new Error(`Invalid kind: ComlinkPrimitiveLiteral`));
    });

    it('returns example object for object definition', () => {
      expect(
        visit(
          {
            kind: 'ObjectDefinition',
            fields: [
              {
                kind: 'FieldDefinition',
                fieldName: 'test',
                required: true,
                type: {
                  kind: 'PrimitiveTypeName',
                  name: 'string',
                },
              },
            ],
          },
          {},
          {}
        )
      ).toEqual({
        kind: 'object',
        properties: [
          {
            name: 'test',
            kind: 'string',
            value: '',
          },
        ],
      });
    });

    it('returns example scalar for primitive definition', () => {
      expect(
        visit(
          {
            kind: 'PrimitiveTypeName',
            name: 'number',
          },
          {},
          {}
        )
      ).toEqual({
        kind: 'number',
        value: 0,
      });
    });

    it('returns example object for model type name', () => {
      expect(
        visit(
          {
            kind: 'ModelTypeName',
            name: 'test',
          },
          {
            test: {
              modelName: 'test',
              kind: 'NamedModelDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'test',
                    required: true,
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                ],
              },
            },
          },
          {}
        )
      ).toEqual({
        kind: 'object',
        properties: [
          {
            name: 'test',
            kind: 'string',
            value: '',
          },
        ],
      });
    });

    it('returns example scalar for union definition', () => {
      expect(
        visit(
          {
            kind: 'UnionDefinition',
            types: [
              {
                kind: 'PrimitiveTypeName',
                name: 'boolean',
              },
              {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'test',
                    required: true,
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'boolean',
                    },
                  },
                ],
              },
            ],
          },
          {},
          {}
        )
      ).toEqual({
        kind: 'boolean',
        value: true,
      });
    });

    it('returns example array for array definition', () => {
      expect(
        visit(
          {
            kind: 'ListDefinition',
            elementType: {
              kind: 'PrimitiveTypeName',
              name: 'number',
            },
          },
          {},
          {}
        )
      ).toEqual({
        kind: 'array',
        items: [
          {
            kind: 'number',
            value: 0,
          },
        ],
      });
    });

    it('returns example scalar for enum definition', () => {
      expect(
        visit(
          {
            kind: 'EnumDefinition',
            values: [
              {
                kind: 'EnumValue',
                value: 43,
              },
            ],
          },
          {},
          {}
        )
      ).toEqual({
        kind: 'number',
        value: 43,
      });
    });
  });

  describe('visitObjecDefinition', () => {
    it('falls back to string when type is not defined', () => {
      expect(
        visitObjecDefinition(
          {
            kind: 'ObjectDefinition',
            fields: [
              {
                kind: 'FieldDefinition',
                fieldName: 'test',
                required: true,
              },
            ],
          },
          {},
          {}
        )
      ).toEqual({
        kind: 'object',
        properties: [
          {
            name: 'test',
            kind: 'string',
            value: '',
          },
        ],
      });
    });

    it('returns example object for object with FieldDefinition fields', () => {
      expect(
        visitObjecDefinition(
          {
            kind: 'ObjectDefinition',
            fields: [
              {
                kind: 'FieldDefinition',
                fieldName: 'test',
                required: true,
                type: {
                  kind: 'PrimitiveTypeName',
                  name: 'string',
                },
              },
            ],
          },
          {},
          {}
        )
      ).toEqual({
        kind: 'object',
        properties: [
          {
            name: 'test',
            kind: 'string',
            value: '',
          },
        ],
      });
    });

    it('returns example object for object with NamedFieldDefinition fields', () => {
      expect(
        visitObjecDefinition(
          {
            kind: 'ObjectDefinition',
            fields: [
              {
                kind: 'FieldDefinition',
                fieldName: 'test',
                required: true,
              },
            ],
          },
          {},
          {
            test: {
              kind: 'NamedFieldDefinition',
              fieldName: 'test',
              type: {
                kind: 'PrimitiveTypeName',
                name: 'string',
              },
            },
          }
        )
      ).toEqual({
        kind: 'object',
        properties: [
          {
            name: 'test',
            kind: 'string',
            value: '',
          },
        ],
      });
    });
  });

  describe('visitListNode', () => {
    it('returns example array for array with ComlinkPrimitiveLiteral fields', () => {
      expect(
        visitListNode(
          {
            kind: 'ListDefinition',
            elementType: {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
          },
          {},
          {}
        )
      ).toEqual({
        kind: 'array',
        items: [
          {
            kind: 'string',
            value: '',
          },
        ],
      });
    });
  });

  describe('visitPrimitiveNode', () => {
    it('returns example scalar for primitive string', () => {
      expect(
        visitPrimitiveNode({
          kind: 'PrimitiveTypeName',
          name: 'string',
        })
      ).toEqual({
        kind: 'string',
        value: '',
      });
    });

    it('returns example scalar for primitive number', () => {
      expect(
        visitPrimitiveNode({
          kind: 'PrimitiveTypeName',
          name: 'number',
        })
      ).toEqual({
        kind: 'number',
        value: 0,
      });
    });

    it('returns example scalar for primitive boolean', () => {
      expect(
        visitPrimitiveNode({
          kind: 'PrimitiveTypeName',
          name: 'boolean',
        })
      ).toEqual({
        kind: 'boolean',
        value: true,
      });
    });
  });

  describe('visitEnumNode', () => {
    it('returns example scalar for enum with string', () => {
      expect(
        visitEnumNode({
          kind: 'EnumDefinition',
          values: [
            {
              kind: 'EnumValue',
              value: 'something',
            },
          ],
        })
      ).toEqual({
        kind: 'string',
        value: 'something',
      });
    });

    it('returns example scalar for enum with number', () => {
      expect(
        visitEnumNode({
          kind: 'EnumDefinition',
          values: [
            {
              kind: 'EnumValue',
              value: 42,
            },
          ],
        })
      ).toEqual({
        kind: 'number',
        value: 42,
      });
    });

    it('returns example scalar for enum with boolean', () => {
      expect(
        visitEnumNode({
          kind: 'EnumDefinition',
          values: [
            {
              kind: 'EnumValue',
              value: true,
            },
          ],
        })
      ).toEqual({
        kind: 'boolean',
        value: true,
      });
    });
  });
});
