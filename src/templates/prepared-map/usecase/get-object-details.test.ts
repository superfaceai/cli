import { getObjectModelDetails } from './get-object-details';
import { ModelType } from './models';

describe('getObjectModelDetails', () => {
  it('returns details from nullable object node', () => {
    expect(
      getObjectModelDetails(
        {
          kind: 'ObjectDefinition',
          fields: [
            {
              kind: 'FieldDefinition',
              fieldName: 'test',
              required: false,
              type: {
                kind: 'PrimitiveTypeName',
                name: 'string',
              },
            },
          ],
        },
        undefined,
        {},
        {}
      )
    ).toEqual({
      modelType: ModelType.OBJECT,
      nonNull: false,
      fields: [
        {
          fieldName: 'test',
          required: false,
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

  it('returns details from non nullable object node', () => {
    expect(
      getObjectModelDetails(
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
});
