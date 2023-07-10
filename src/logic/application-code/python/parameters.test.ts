import { prepareParameters } from './parameters';

describe('prepareParameters', () => {
  it('should return empty object if parameters are undefined', () => {
    expect(prepareParameters('provider', undefined)).toEqual({
      parametersString: '{}',
      required: [],
    });
  });

  it('should return empty object if parameters are empty', () => {
    expect(prepareParameters('provider', [])).toEqual({
      parametersString: '{}',
      required: [],
    });
  });

  it('should return correct parameters string', () => {
    expect(
      prepareParameters('provider', [{ name: 'test', default: 'value' }])
    ).toEqual({
      parametersString: `{ "test": os.getenv('PROVIDER_TEST') }`,
      required: ['$PROVIDER_TEST'],
    });
  });

  it('should return correct parameters string with multiple parameters', () => {
    expect(
      prepareParameters('provider', [
        { name: 'test' },
        { name: 'test2', default: 'value' },
      ])
    ).toEqual({
      parametersString: `{ "test": os.getenv('PROVIDER_TEST'), "test2": os.getenv('PROVIDER_TEST2') }`,
      required: ['$PROVIDER_TEST', '$PROVIDER_TEST2'],
    });
  });
});
