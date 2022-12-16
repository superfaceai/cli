export default `import { SuperfaceTest } from '@superfaceai/testing';
{{#if station}}

import { buildSuperfaceTest } from '../../../test-config';
{{/if}}

describe('{{profile}}/{{provider}}', () => {
  let superface: SuperfaceTest;

  beforeEach(() => {
{{#if station}}
    superface = buildSuperfaceTest({
      profile: '{{profile}}',
      provider: '{{provider}}'
});
{{/if}}
{{#unless station}}
    superface = new SuperfaceTest({
      profile: '{{profile}}',
      provider: '{{provider}}'
    });
{{/unless}}
  });

  {{#each useCases}}
  {{>UseCase onlySuccess=../onlySuccess}}
  {{/each}}
  
});`;
