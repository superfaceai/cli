import { TestingCase, TestingInput } from '../common/test-config';

/* eslint-disable no-useless-escape */
export function buildTest([_index, config]: [
  index: number,
  config: TestingInput
]): string {
  return `import { Profile, Provider, SuperfaceClient } from '@superfaceai/one-sdk';
const ISO_DATE_REGEX = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)((-(\d{2}):(\d{2})|Z)?)/gm;

describe('${config.profileId}/${config.provider}', () => {
  let client: SuperfaceClient;
  let profile: Profile;
  let provider: Provider;

  const removeTimestamp = (payload: string): string =>
    payload.replace(ISO_DATE_REGEX, '');

  beforeAll(async () => {
    jest.setTimeout(10000);

    client = new SuperfaceClient();
    profile = await client.getProfile('${config.profileId}');
    provider = await client.getProvider('${config.provider}');

    process.env.SUPERFACE_DISABLE_METRIC_REPORTING = 'true';
  });

  it('should have profile defined', () => {
    expect(profile).toBeDefined();
  });

  it('should have provider defined', () => {
    expect(provider).toBeDefined();
  });

  describe('testing cases', () => {
    ${buildTestingCases(config.data)}
  });
});`;
}
/* eslint-enable no-useless-escape */

export function buildTestingCases(cases: TestingCase[]): string {
  let tests = '';

  for (const [i, test] of cases.entries()) {
    tests += `
      it('${i + 1} - ${test.useCase}', async () => {
        const useCase = profile.getUseCase('${test.useCase}');
  
        expect(useCase).toBeDefined();
  
        // TODO: fix unknown types
        const result = await useCase.perform(${JSON.stringify(
          test.input
        )}, { provider });`;
    if (test.isError) {
      tests += `
        const errorMessage = result.isErr() && removeTimestamp(result.error.message);
        expect(result.isErr()).toBeTruthy();
        expect(errorMessage).toMatchSnapshot();`;
    } else {
      tests += `
        const resultValue = result.isOk() && result.value;
        expect(result.isOk()).toBeTruthy();
        expect(resultValue).toMatchSnapshot();`;
    }
    tests += `
      });
`;
  }

  return tests;
}
