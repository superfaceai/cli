import type { ProfileId } from '../common/profile';
import type { ExampleInput } from '../logic/prepare/test';

export function testTemplate(
  profile: ProfileId,
  provider: string,
  parameters: Record<string, ExampleInput[]>
): string {
  const head = `import { SuperfaceTest } from '@superfaceai/testing';

describe('${profile.id}/${provider}', () => {
  let superface: SuperfaceTest;

  beforeEach(() => {
    superface = new SuperfaceTest({
      profile: '${profile.id}',
      provider: '${provider}',
    });
  });
  `;

  let body = '';

  for (const parameter of Object.keys(parameters)) {
    body += testUseCaseTemplete(parameter, parameters[parameter]);
  }

  return `${head}
  ${body}
});`;
}
function testUseCaseTemplete(usecase: string, inputs: ExampleInput[]): string {
  let testCases = '';

  for (const input of inputs) {
    testCases += testCaseTemplete(usecase, input);
  }

  return `describe('${usecase}', () => {
    ${testCases}
  });`;
}

function testCaseTemplete(usecase: string, input: ExampleInput): string {
  const description =
    input.exampleKind === 'error'
      ? 'should map error'
      : 'should perform successfully';
  const checkFn = input.exampleKind !== 'error' ? 'isOk()' : 'isErr()';

  return `
    //  vvvv  specify test case name
    it('${description}', async () => {
      const result = await superface.run({
        useCase: '${usecase}',
        input: ${input.input}
      })
      
      expect(result.${checkFn}).toBe(true);
      expect(result).toMatchSnapshot();
    });`;
}
