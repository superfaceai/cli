import * as fs from 'fs';
import * as nodePath from 'path';
import { promisify, inspect } from 'util';

import { Provider } from '@superfaceai/sdk';

const readFile = promisify(fs.readFile);

async function loadAsts(
  scope: string | undefined,
  name: string,
  providerName: string,
  variantName?: string
): Promise<{
  profile: ConstructorParameters<typeof Provider>[0],
  map: Exclude<ConstructorParameters<typeof Provider>[1], string>
}> {
  // if scope is not undefined, add it to the build path
  // let buildPath = nodePath.join('superface', 'build');
  let buildPath = nodePath.join('build');
  if (scope !== undefined) {
    buildPath = nodePath.join(buildPath, scope);
  }

  // Read the profile and map ASTs from the build folder
  const profileAst = JSON.parse(
    await readFile(nodePath.join(buildPath, `${name}.supr.ast.json`), { encoding: 'utf-8' })
  );
  const variant = variantName ? '.' + variantName : '';
  const mapAst = JSON.parse(
    await readFile(nodePath.join(buildPath, `${name}.${providerName}${variant}.suma.ast.json`), { encoding: 'utf-8' })
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
  baseUrl?: string,
  auth?: Parameters<Provider['bind']>[0]
) {
 const asts = await loadAsts(scope, name, providerName, variantName);

  // 1. Create the provider object with the read ASTs
  const provider = new Provider(
    asts.profile,
    asts.map,
    baseUrl
  );

  // 2. Bind the provider
  const boundProvider = await provider.bind({
    ...auth
  });

  // 3. Perform the usecase with the bound provider
  const result = await boundProvider.perform(
    'PubOpeningHours',
    {
      city: "Praha",
      nameRegex: "Diego"
    }
  );

  // Do something with the result
  // Here we just print it
  console.log(
    `PubOpeningHours/${providerName}${variantName ? '.' + variantName : ''} result:`,
    inspect(result, {
      depth: 5,
      colors: true,
    })
  );
}

async function main() {
  // Iterate over the input arguments
  // Their expected format is `scope/name.provider.variant` (scope nad variant are optional)
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

    // TODO: Choose auth and base url based on provider name
    // Later they will be read by the SDK from provider.json and from the registry
    const baseUrl = 'https://overpass-api.de';
    const auth = {};

    execute(
      scope,
      name,
      provider,
      variant,
      baseUrl,
      auth
    );
  }
}

main();