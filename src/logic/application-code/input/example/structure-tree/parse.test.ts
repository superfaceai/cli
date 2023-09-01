import {
  visit,
  visitEnumNode,
  visitListNode,
  visitObjecDefinition,
  visitPrimitiveNode,
} from './parse';

describe('Parse structure tree', () => {
  it('throws when type is not defined', () => {
    expect(() =>
      visit(
        {
          kind: 'ComlinkPrimitiveLiteral',
          value: '',
        },
        {},
        {},
        false
      )
    ).toThrowError(new Error(`Invalid kind: ComlinkPrimitiveLiteral`));
  });

  describe('visitUnionDefinition', () => {
    describe('with example', () => {
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
            {},
            false,
            {
              kind: `ComlinkPrimitiveLiteral`,
              value: false,
            }
          )
        ).toEqual({
          kind: 'boolean',
          value: false,
          required: false,
        });
      });
    });

    describe('without example', () => {
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
            {},
            false
          )
        ).toEqual({
          kind: 'boolean',
          value: true,
          required: false,
        });
      });
    });
  });

  describe('visitEnumDefinition', () => {
    describe('with example', () => {
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
                {
                  kind: 'EnumValue',
                  value: 27,
                },
              ],
            },
            {},
            {},
            false,
            {
              kind: `ComlinkPrimitiveLiteral`,
              value: 27,
            }
          )
        ).toEqual({
          kind: 'number',
          value: 27,
          required: false,
        });
      });
    });

    describe('without example', () => {
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
                {
                  kind: 'EnumValue',
                  value: 27,
                },
              ],
            },
            {},
            {},
            false
          )
        ).toEqual({
          kind: 'number',
          value: 43,
          required: false,
        });
      });
    });
  });

  describe('visitObjecDefinition', () => {
    describe('with example', () => {
      it('returns example object for object with field using NamedFieldDefinition', () => {
        expect(
          visit(
            {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'a',
                  required: true,
                },
              ],
            },
            {},
            {
              a: {
                kind: 'NamedFieldDefinition',
                fieldName: 'a',
                type: {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'b',
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
            false,
            {
              kind: `ComlinkObjectLiteral`,
              fields: [
                {
                  kind: `ComlinkAssignment`,
                  key: [`a`],
                  value: {
                    kind: `ComlinkObjectLiteral`,
                    fields: [
                      {
                        kind: `ComlinkAssignment`,
                        key: [`b`],
                        value: {
                          kind: `ComlinkPrimitiveLiteral`,
                          value: `test value`,
                        },
                      },
                    ],
                  },
                },
              ],
            }
          )
        ).toEqual({
          kind: 'object',
          properties: [
            {
              name: 'a',
              kind: 'object',
              properties: [
                {
                  name: 'b',
                  kind: 'string',
                  required: true,
                  value: 'test value',
                },
              ],
            },
          ],
        });
      });

      it('returns example object for object with field using NamedModelDefinition', () => {
        expect(
          visit(
            {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'a',
                  required: true,
                  type: {
                    kind: 'ModelTypeName',
                    name: 'b',
                  },
                },
              ],
            },
            {
              b: {
                modelName: 'b',
                kind: 'NamedModelDefinition',
                type: {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'c',
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
            {},
            false,
            {
              kind: `ComlinkObjectLiteral`,
              fields: [
                {
                  kind: `ComlinkAssignment`,
                  key: [`a`],
                  value: {
                    kind: `ComlinkObjectLiteral`,
                    fields: [
                      {
                        kind: `ComlinkAssignment`,
                        key: [`c`],
                        value: {
                          kind: `ComlinkPrimitiveLiteral`,
                          value: `test`,
                        },
                      },
                    ],
                  },
                },
              ],
            }
          )
        ).toEqual({
          kind: 'object',
          properties: [
            {
              name: 'a',
              kind: 'object',
              properties: [
                {
                  name: 'c',
                  kind: 'string',
                  required: true,
                  value: 'test',
                },
              ],
            },
          ],
        });
      });

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
              required: true,
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
            {},
            {
              kind: 'ComlinkObjectLiteral',
              fields: [
                {
                  kind: 'ComlinkAssignment',
                  key: ['test'],
                  value: {
                    kind: 'ComlinkPrimitiveLiteral',
                    value: 'example',
                  },
                },
              ],
            }
          )
        ).toEqual({
          kind: 'object',
          properties: [
            {
              name: 'test',
              kind: 'string',
              value: 'example',
              required: true,
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
            },
            {
              kind: 'ComlinkObjectLiteral',
              fields: [
                {
                  kind: 'ComlinkAssignment',
                  key: ['test'],
                  value: {
                    kind: 'ComlinkPrimitiveLiteral',
                    value: 'example',
                  },
                },
              ],
            }
          )
        ).toEqual({
          kind: 'object',
          properties: [
            {
              name: 'test',
              kind: 'string',
              value: 'example',
              required: true,
            },
          ],
        });
      });
    });

    describe('without example', () => {
      it('returns example object for object with field using NamedFieldDefinition', () => {
        expect(
          visit(
            {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'a',
                  required: true,
                },
              ],
            },
            {},
            {
              a: {
                kind: 'NamedFieldDefinition',
                fieldName: 'a',
                type: {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'b',
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
            false
          )
        ).toEqual({
          kind: 'object',
          properties: [
            {
              name: 'a',
              kind: 'object',
              properties: [
                {
                  name: 'b',
                  kind: 'string',
                  required: true,
                  value: '',
                },
              ],
            },
          ],
        });
      });

      it('returns example object for object with field using NamedModelDefinition', () => {
        expect(
          visit(
            {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'a',
                  required: true,
                  type: {
                    kind: 'ModelTypeName',
                    name: 'test',
                  },
                },
              ],
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
                      fieldName: 'a',
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
            {},
            false
          )
        ).toEqual({
          kind: 'object',
          properties: [
            {
              name: 'a',
              kind: 'object',
              properties: [
                {
                  name: 'a',
                  kind: 'string',
                  required: true,
                  value: '',
                },
              ],
            },
          ],
        });
      });

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
              required: true,
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
              required: true,
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
              required: true,
            },
          ],
        });
      });
    });
  });

  describe('visitListNode', () => {
    describe('with example', () => {
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
            {},
            false,
            {
              kind: 'ComlinkListLiteral',
              items: [
                {
                  kind: 'ComlinkPrimitiveLiteral',
                  value: 'test',
                },
              ],
            }
          )
        ).toEqual({
          kind: 'array',
          items: [
            {
              kind: 'string',
              value: 'test',
              required: false,
            },
          ],
          required: false,
        });
      });

      it('returns example array for required array with ComlinkPrimitiveLiteral fields', () => {
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
            {},
            true,
            {
              kind: 'ComlinkListLiteral',
              items: [
                {
                  kind: 'ComlinkPrimitiveLiteral',
                  value: 'test',
                },
              ],
            }
          )
        ).toEqual({
          kind: 'array',
          items: [
            {
              kind: 'string',
              value: 'test',
              required: false,
            },
          ],
          required: true,
        });
      });
    });

    describe('without example', () => {
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
            {},
            false
          )
        ).toEqual({
          kind: 'array',
          items: [
            {
              kind: 'string',
              value: '',
              required: false,
            },
          ],
          required: false,
        });
      });

      it('returns example array for required array with ComlinkPrimitiveLiteral fields', () => {
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
            {},
            true
          )
        ).toEqual({
          kind: 'array',
          items: [
            {
              kind: 'string',
              value: '',
              required: false,
            },
          ],
          required: true,
        });
      });
    });
  });

  describe('visitPrimitiveNode', () => {
    describe('with example', () => {
      it('returns example scalar for primitive string', () => {
        expect(
          visitPrimitiveNode(
            {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
            true,
            {
              kind: 'ComlinkPrimitiveLiteral',
              value: 'test',
            }
          )
        ).toEqual({
          kind: 'string',
          value: 'test',
          required: true,
        });
      });

      it('returns example scalar for primitive number', () => {
        expect(
          visitPrimitiveNode(
            {
              kind: 'PrimitiveTypeName',
              name: 'number',
            },
            false,
            {
              kind: 'ComlinkPrimitiveLiteral',
              value: 12,
            }
          )
        ).toEqual({
          kind: 'number',
          value: 12,
          required: false,
        });
      });

      it('returns example scalar for primitive boolean', () => {
        expect(
          visitPrimitiveNode(
            {
              kind: 'PrimitiveTypeName',
              name: 'boolean',
            },
            true,
            {
              kind: 'ComlinkPrimitiveLiteral',
              value: false,
            }
          )
        ).toEqual({
          kind: 'boolean',
          value: false,
          required: true,
        });
      });
    });

    describe('without example', () => {
      it('returns example scalar for primitive string', () => {
        expect(
          visitPrimitiveNode(
            {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
            true
          )
        ).toEqual({
          kind: 'string',
          value: '',
          required: true,
        });
      });

      it('returns example scalar for primitive number', () => {
        expect(
          visitPrimitiveNode(
            {
              kind: 'PrimitiveTypeName',
              name: 'number',
            },
            false
          )
        ).toEqual({
          kind: 'number',
          value: 0,
          required: false,
        });
      });

      it('returns example scalar for primitive boolean', () => {
        expect(
          visitPrimitiveNode(
            {
              kind: 'PrimitiveTypeName',
              name: 'boolean',
            },
            true
          )
        ).toEqual({
          kind: 'boolean',
          value: true,
          required: true,
        });
      });
    });
  });

  describe('visitEnumNode', () => {
    describe('with example', () => {
      it('returns example scalar for enum with string', () => {
        expect(
          visitEnumNode(
            {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: 'something',
                },
              ],
            },
            false,
            {
              kind: 'ComlinkPrimitiveLiteral',
              value: 'real value',
            }
          )
        ).toEqual({
          kind: 'string',
          value: 'real value',
          required: false,
        });
      });

      it('returns example scalar for enum with number', () => {
        expect(
          visitEnumNode(
            {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: 42,
                },
              ],
            },
            false,
            {
              kind: 'ComlinkPrimitiveLiteral',
              value: 12,
            }
          )
        ).toEqual({
          kind: 'number',
          value: 12,
          required: false,
        });
      });

      it('returns example scalar for enum with boolean', () => {
        expect(
          visitEnumNode(
            {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: true,
                },
              ],
            },
            false,
            {
              kind: 'ComlinkPrimitiveLiteral',
              value: false,
            }
          )
        ).toEqual({
          kind: 'boolean',
          value: false,
          required: false,
        });
      });
    });

    describe('without example', () => {
      it('returns example scalar for enum with string', () => {
        expect(
          visitEnumNode(
            {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: 'something',
                },
              ],
            },
            false
          )
        ).toEqual({
          kind: 'string',
          value: 'something',
          required: false,
        });
      });

      it('returns example scalar for enum with number', () => {
        expect(
          visitEnumNode(
            {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: 42,
                },
              ],
            },
            false
          )
        ).toEqual({
          kind: 'number',
          value: 42,
          required: false,
        });
      });

      it('returns example scalar for enum with boolean', () => {
        expect(
          visitEnumNode(
            {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: true,
                },
              ],
            },
            false
          )
        ).toEqual({
          kind: 'boolean',
          value: true,
          required: false,
        });
      });
    });
  });
});
