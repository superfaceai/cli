import { getUnionModelDetails } from './get-union-details';
import { ModelType } from './models';

describe('getUnionModelDetails', () => {
  it('returns details from nullable union node', () => {
    expect(
      getUnionModelDetails(
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

  it('returns details from non nullable union node', () => {
    expect(
      getUnionModelDetails(
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
        true,
        {},
        {}
      )
    ).toEqual({
      nonNull: true,
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
