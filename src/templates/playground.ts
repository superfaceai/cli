export function packageJson(): string {
  return `{
  "name": "playground",
  "private": true,
  "dependencies": {
    "@superfaceai/sdk": "^0.0.6"
  },
  "devDependencies": {
    "@types/node": "^14",
    "typescript": "^4"
  }
}`;
}

export function npmRc(): string {
  return '@superfaceai:registry=https://npm.pkg.github.com\n';
}

export function gitignore(): string {
  return `build
node_modules
package-lock.json
`;
}

export type GlueTemplateType = 'empty' | 'pubs';

/**
 * Returns a glue script of given template `type` with given `usecase`.
 */
export function glueScript(
  type: GlueTemplateType,
  usecase: string
): string {
  switch (type) {
    case 'empty':
      return empty(usecase);
    case 'pubs':
      return pubs(usecase);
  }
}

function common(usecase: string, input: string): string {
  return `import * as fs from 'fs';
import * as nodePath from 'path';
import { promisify, inspect } from 'util';

import { Provider } from '@superfaceai/sdk';

const readFile = promisify(fs.readFile);

async function loadAsts(
  scope: string | undefined,
  name: string,
  providerName: string,
  variantName?: undefined,
): Promise<{
  profile: ConstructorParameters<typeof Provider>[0],
  map: Exclude<ConstructorParameters<typeof Provider>[1], string>
}> {
  // if scope is not undefined, add it to the build path
  let buildPath = nodePath.join('superface', 'build');
  if (scope !== undefined) {
    buildPath = nodePath.join(buildPath, scope);
  }

  // Read the profile and map ASTs from the build folder
  const profileAst = JSON.parse(
    await readFile(nodePath.join(buildPath, \`\${name}.supr.ast.json\`), { encoding: 'utf-8' })
  );
  const variant = variantName ? '.' + variantName : '';
  const mapAst = JSON.parse(
    await readFile(nodePath.join(buildPath, \`\${name}.\${providerName}\${variant}.suma.ast.json\`), { encoding: 'utf-8' })
  );

  // As this is a development script, the correct structure of the loaded asts is not checked
  // This should not be a problem as long as the input comes from a valid parser
  return {
    profile: profileAst,
    map: mapAst
  };
}

/** Execute one specific pair of profile and map. */
async function execute(
  scope: string | undefined,
  name: string,
  providerName: string,
  variantName?: string,
  providerBaseUrl?: string
) {
  const asts = await loadAsts(scope, name, variantName);

  // 1. Create the provider object with the read ASTs
  const provider = new Provider(asts.profile, asts.map, providerBaseUrl);

  // 2. Bind the provider
  const boundProvider = await provider.bind({
    // TODO: auth keys 
  });

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
  // Their expected format is \`scope/name.provider.variant\`
  for (const arg of process.argv.slice(2)) {
    let scope: string | undefined = undefined;
    let name: string = arg;
    let provider: string = name;
    let variant: string | undefined = undefined;
    
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
      variant,
      // TODO: Base url
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
