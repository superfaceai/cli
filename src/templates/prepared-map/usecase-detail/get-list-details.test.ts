import { getListModelDetails } from './get-list-details';
import { ModelType } from './models';

describe('getListModelDetails', () => {
  it('returns details from nullable list node with primitive nodes', () => {
    expect(
      getListModelDetails(
        {
          kind: 'ListDefinition',
          elementType: {
            kind: 'PrimitiveTypeName',
            name: 'string',
          },
        },
        false,
        {},
        {}
      )
    ).toEqual({
      modelType: ModelType.LIST,
      nonNull: false,
      model: {
        modelType: ModelType.SCALAR,
        nonNull: false,
        scalarType: 'string',
      },
    });
  });

  it('returns details from non nullable list node with primitive nodes', () => {
    expect(
      getListModelDetails(
        {
          kind: 'ListDefinition',
          elementType: {
            kind: 'PrimitiveTypeName',
            name: 'string',
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
        modelType: ModelType.SCALAR,
        nonNull: false,
        scalarType: 'string',
      },
    });
  });

  it('returns details from nullable list node with object nodes', () => {
    expect(
      getListModelDetails(
        {
          kind: 'ListDefinition',
          elementType: {
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
        false,
        {},
        {}
      )
    ).toEqual({
      modelType: ModelType.LIST,
      nonNull: false,
      model: {
        modelType: ModelType.OBJECT,
        nonNull: false,
        fields: [
          {
            fieldName: 'test',
            required: true,
            nonNull: false,
            model: {
              modelType: ModelType.SCALAR,
              nonNull: false,
              scalarType: 'string',
            },
            description: undefined,
          },
        ],
      },
    });
  });

  it('returns details from non nullable list node with object nodes', () => {
    expect(
      getListModelDetails(
        {
          kind: 'ListDefinition',
          elementType: {
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
        true,
        {},
        {}
      )
    ).toEqual({
      modelType: ModelType.LIST,
      nonNull: true,
      model: {
        modelType: ModelType.OBJECT,
        nonNull: false,
        fields: [
          {
            fieldName: 'test',
            required: true,
            nonNull: false,
            model: {
              modelType: ModelType.SCALAR,
              nonNull: false,
              scalarType: 'string',
            },
            description: undefined,
          },
        ],
      },
    });
  });

  it('returns details from nullable list node with list nodes', () => {
    expect(
      getListModelDetails(
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
        false,
        {},
        {}
      )
    ).toEqual({
      modelType: ModelType.LIST,
      nonNull: false,
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

  it('returns details from non nullable list node with list nodes', () => {
    expect(
      getListModelDetails(
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
});
