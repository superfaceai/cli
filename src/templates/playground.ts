import { VERSION } from '@superfaceai/sdk';

import { TemplateType } from './common';

export function packageJson(): string {
  /* eslint-disable @typescript-eslint/restrict-template-expressions */
  return `{
  "name": "playground",
  "private": true,
  "dependencies": {
    "@superfaceai/sdk": "${VERSION}"
  },
  "devDependencies": {
    "@types/node": "^14",
    "typescript": "^4"
  }
}`;
  /* eslint-enable @typescript-eslint/restrict-template-expressions */
}

/**
 * Returns a glue script of given template `type` with given `usecase`.
 */
export function glueScript(type: TemplateType, usecase: string): string {
  switch (type) {
    case 'empty':
      return empty(usecase);
    case 'pubs':
      return pubs(usecase);
  }
}

function common(usecase: string, input: string): string {
  return `import { inspect } from 'util';

  import { Provider } from '@superfaceai/sdk';
  
  /** Execute one specific pair of profile and map. */
  async function execute(
    scope: string | undefined,
    name: string,
    providerName: string,
    variantName?: string
  ) {
    let profileId = name;
    if (scope !== undefined) {
      profileId = scope + '/' + name;
    }
  
    // 1. Create the provider object - the build artifacts are located by the sdk according to super.json
    const provider = new Provider(
      profileId,
      providerName
    );
  
    // 2. Bind the provider - values are taken from super.json unless overridden here
    const boundProvider = await provider.bind();
  
    // 3. Perform the usecase with the bound provider - defaults are taken from super.json again
    const result = await boundProvider.perform(
      '${usecase}',
      ${input}
    );
  
    // Do something with the result
    // Here we just print it
    console.log(
      \`${usecase}/\${providerName}\${variantName ? '.' + variantName : ''} result:\`,
      inspect(result, {
        depth: 5,
        colors: true,
      })
    );
  }
  
  async function main() {
    // Iterate over the input arguments
    // Their expected format is \`scope/name.provider.variant\` (scope and variant are optional)
    for (const arg of process.argv.slice(2)) {
      let scope: string | undefined;
      let name: string = arg;
      let provider: string = name;
      let variant: string | undefined;
  
      const scopeSplit = name.split('/');
      if (scopeSplit.length === 2) {
        scope = scopeSplit[0];
        name = scopeSplit[1];
      } else if (scopeSplit.length !== 1) {
        console.warn('Skipping argument', arg);
        continue;
      }
  
      const nameSplit = name.split('.');
      if (nameSplit.length === 1 || nameSplit.length >= 4) {
        console.warn('Skipping argument', arg);
        continue;
      }
  
      name = nameSplit[0];
      provider = nameSplit[1];
      if (nameSplit.length === 3) {
        variant = nameSplit[2];
      }
  
      execute(
        scope,
        name,
        provider,
        variant
      );
    }
  }
  
  main();
  `;
}

export function empty(usecase: string): string {
  return common(usecase, '{}');
}

export function pubs(usecase: string): string {
  return common(usecase, '{ city: "Praha", nameRegex: "Diego" }');
}
