export function packageJson(): string {
  return `{
  "name": "playground",
  "private": true,
  "dependencies": {
    "@superfaceai/sdk": "^0.0.7"
  },
  "devDependencies": {
    "@types/node": "^14",
    "typescript": "^4"
  }
}`;
}

export type GlueTemplateType = 'empty' | 'pubs';

/**
 * Returns a glue script of given template `type` with given `usecase`.
 */
export function glueScript(type: GlueTemplateType, usecase: string): string {
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
  // 1. Create the provider object - the build artifacts are located by the sdk according to super.json
  const provider = new Provider(
    scope !== undefined ? \`\${scope}/\${name}\` : name,
    \`file:\${providerName}.provider.json\`
  );

  // 2. Bind the provider - values are taken from super.json unless overridden here
  const boundProvider = await provider.bind({});

  // 3. Perform the usecase with the bound provider
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

    // TODO: Variant is unused
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
