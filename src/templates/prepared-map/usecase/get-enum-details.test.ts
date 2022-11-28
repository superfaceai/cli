import { getEnumModelDetails } from './get-enum-details';
import { ModelType } from './models';

describe('getEnumModelDetails', () => {
  it('returns details from nullable enum node', () => {
    expect(
      getEnumModelDetails({
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
      })
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

  it('returns details from non nullable enum node', () => {
    expect(
      getEnumModelDetails(
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
        true
      )
    ).toEqual({
      modelType: ModelType.ENUM,
      nonNull: true,
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
});
