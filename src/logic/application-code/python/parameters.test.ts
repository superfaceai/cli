import { MockLogger } from '../../../common';
import { prepareParametersString } from './parameters';

describe('prepareParametersString', () => {
  const logger = new MockLogger();

  it('should return empty object if parameters are undefined', () => {
    expect(prepareParametersString('provider', undefined, { logger })).toEqual(
      '{}'
    );
  });

  it('should return empty object if parameters are empty', () => {
    expect(prepareParametersString('provider', [], { logger })).toEqual('{}');
  });

  it('should return correct parameters string', () => {
    expect(
      prepareParametersString(
        'provider',
        [{ name: 'test', default: 'value' }],
        { logger }
      )
    ).toEqual(`{ "test": os.getenv('PROVIDER_TEST') }`);
  });

  it('should return correct parameters string with multiple parameters', () => {
    expect(
      prepareParametersString(
        'provider',
        [{ name: 'test' }, { name: 'test2', default: 'value' }],
        { logger }
      )
    ).toEqual(
      `{ "test": os.getenv('PROVIDER_TEST'), "test2": os.getenv('PROVIDER_TEST2') }`
    );
  });
});
