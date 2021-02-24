import { inspect } from 'util';
import { join as joinPath } from 'path';

import { Provider } from '@superfaceai/sdk';

/** Execute one specific pair of profile and map. */
async function execute(
  scope: string | undefined,
  name: string,
  providerName: string,
  variantName?: string
) {
  let baseBuildPath = joinPath('superface', 'build');
  if (scope !== undefined) {
    baseBuildPath = joinPath(scope);
  }

  const profilePath = joinPath(baseBuildPath, `${name}.supr.ast.json`);
  const mapVariant = (variantName !== undefined && variantName !== 'default') ? '.' + variantName : '';
  const mapPath = joinPath(baseBuildPath, `${name}.${providerName}${mapVariant}.suma.ast.json`);

  // 1. Create the provider object - the build artifacts are located by the sdk according to super.json
  const provider = new Provider(
    'file:' + profilePath,
    `file:${providerName}.provider.json`,
    'file:' + mapPath
  );

  // 2. Bind the provider - values are taken from super.json unless overridden here
  const boundProvider = await provider.bind();

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
  // Their expected format is `scope/name.provider.variant` (scope and variant are optional)
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
