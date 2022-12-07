export default `import { SuperfaceTest } from '@superfaceai/testing';

describe('{{profile}}/{{provider}}', () => {
  let superface: SuperfaceTest;

  beforeEach(() => {
    superface = new SuperfaceTest({
      profile: '{{profile}}',
      provider: '{{provider}}',
      testInstance: expect
    });
  });

  {{#each useCases}}
  {{>UseCase onlySuccess=../onlySuccess}}
  {{/each}}
  
});`;
