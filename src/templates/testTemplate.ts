import { ProfileId } from '../common/profile';
import { ExampleInput } from '../logic/prepare-test';

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

  return `
    it('${description}', async () => {
      await expect(
        superface.run({
          useCase: '${usecase}',
          input: ${input.input}
        })
      ).resolves.toMatchSnapshot();
    });`;
}
