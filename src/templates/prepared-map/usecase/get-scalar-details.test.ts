import { getScalarModelDetails } from './get-scalar-details';
import { ModelType } from './models';

describe('getScalarModelDetails', () => {
  it('returns details from nullable scalar node', () => {
    expect(
      getScalarModelDetails(
        {
          kind: 'PrimitiveTypeName',
          name: 'boolean',
        },
        undefined
      )
    ).toEqual({
      modelType: ModelType.SCALAR,
      nonNull: false,
      scalarType: 'boolean',
    });
  });

  it('returns details from non nullable scalar node', () => {
    expect(
      getScalarModelDetails(
        {
          kind: 'PrimitiveTypeName',
          name: 'boolean',
        },
        true
      )
    ).toEqual({
      modelType: ModelType.SCALAR,
      nonNull: true,
      scalarType: 'boolean',
    });
  });
});
