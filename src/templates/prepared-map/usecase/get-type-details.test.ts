import { getTypeDetails } from './get-type-details';
import { ModelType } from './models';

describe('getTypeDetails', () => {
  it('returns null if type is undefined', () => {
    expect(getTypeDetails(undefined, undefined, {}, {})).toBeNull();
  });

  it('returns null if kind is not actionable', () => {
    expect(
      getTypeDetails(
        { kind: 'ComlinkPrimitiveLiteral', value: 0 },
        undefined,
        {},
        {}
      )
    ).toBeNull();
  });

  it('returns detail from object node', () => {
    expect(
      getTypeDetails(
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
        true,
        {},
        {}
      )
    ).toEqual({
      modelType: ModelType.OBJECT,
      nonNull: true,
      fields: [
        {
          fieldName: 'test',
          required: true,
          model: {
            modelType: ModelType.SCALAR,
            nonNull: false,
            scalarType: 'string',
          },
          description: undefined,
        },
      ],
    });
  });

  it('returns detail from list node', () => {
    expect(
      getTypeDetails(
        {
          kind: 'ListDefinition',
          elementType: {
            kind: 'ListDefinition',
            elementType: {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
          },
        },
        true,
        {},
        {}
      )
    ).toEqual({
      modelType: ModelType.LIST,
      nonNull: true,
      model: {
        modelType: ModelType.LIST,
        nonNull: false,
        model: {
          modelType: ModelType.SCALAR,
          nonNull: false,
          scalarType: 'string',
        },
        description: undefined,
      },
    });
  });

  it('returns detail from primitive node', () => {
    expect(
      getTypeDetails(
        {
          kind: 'PrimitiveTypeName',
          name: 'string',
        },
        true,
        {},
        {}
      )
    ).toEqual({
      modelType: ModelType.SCALAR,
      nonNull: true,
      scalarType: 'string',
    });
  });

  it('returns detail from enum node', () => {
    expect(
      getTypeDetails(
        {
          kind: 'EnumDefinition',
          values: [
            {
              kind: 'EnumValue',
              value: 'first',
            },
            {
              kind: 'EnumValue',
              value: 'second',
            },
          ],
        },
        undefined,
        {},
        {}
      )
    ).toEqual({
      modelType: ModelType.ENUM,
      nonNull: false,
      enumElements: [
        {
          value: 'first',
          title: undefined,
        },
        {
          value: 'second',
          title: undefined,
        },
      ],
    });
  });

  it('returns detail from model node', () => {
    expect(
      getTypeDetails(
        {
          kind: 'ModelTypeName',
          name: 'test',
        },
        undefined,
        {
          test: {
            kind: 'NamedModelDefinition',
            modelName: 'test',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
          },
        },
        {}
      )
    ).toEqual({
      modelType: ModelType.SCALAR,
      nonNull: false,
      scalarType: 'string',
    });
  });

  it('returns detail from non null node', () => {
    expect(
      getTypeDetails(
        {
          kind: 'NonNullDefinition',
          type: {
            kind: 'PrimitiveTypeName',
            name: 'string',
          },
        },
        undefined,
        {},
        {}
      )
    ).toEqual({
      modelType: ModelType.SCALAR,
      nonNull: true,
      scalarType: 'string',
    });
  });

  it('returns detail from union node', () => {
    expect(
      getTypeDetails(
        {
          kind: 'UnionDefinition',
          types: [
            {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
            {
              kind: 'PrimitiveTypeName',
              name: 'number',
            },
          ],
        },
        undefined,
        {},
        {}
      )
    ).toEqual({
      nonNull: false,
      modelType: ModelType.UNION,
      types: [
        {
          modelType: ModelType.SCALAR,
          nonNull: false,
          scalarType: 'string',
        },
        {
          modelType: ModelType.SCALAR,
          nonNull: false,
          scalarType: 'number',
        },
      ],
    });
  });
});
