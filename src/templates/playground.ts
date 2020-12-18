export function packageJson(name: string): string {
  return `{
  "name": "${name}",
  "private": true,
  "dependencies": {
    "@superfaceai/sdk": "^0.0.4"
  },
  "devDependencies": {
    "@types/node": "^14.14.10",
    "typescript": "^4"
  }
}`;
}

export function npmRc(): string {
  return '@superfaceai:registry=https://npm.pkg.github.com\n';
}

export type GlueTemplateType = 'empty' | 'pubs';
/**
 * Returns a glue script of given template `type` with given `name` and `provider`.
 */
export function glueScript(
  type: GlueTemplateType,
  name: string,
  provider: string
): string {
  switch (type) {
    case 'empty':
      return empty(name, provider);
    case 'pubs':
      return pubs(name, provider);
  }
}

export function empty(name: string, provider: string): string {
  return `
import * as fs from 'fs';
import { promisify, inspect } from 'util';
import { Provider } from '@superfaceai/sdk'; // The sdk is where the main work is performed

const readFile = promisify(fs.readFile);

async function main() {
  // Load the compiled JSON ASTs from local files
  // These files are compiled when running \`superface play ${name}\` or \`superface compile ${name}.supr ${name}.${provider}.suma\` in the current directory
  const profileAst = JSON.parse(
    await readFile('${name}.supr.ast.json', { encoding: 'utf-8' })
  );
  const mapAst = JSON.parse(
    await readFile('${name}.${provider}.suma.ast.json', { encoding: 'utf-8' })
  );

  // Crate a new provider from local files.
  const provider = new Provider(
    // the loaded ASTs
    profileAst,
    mapAst,
    // base url for relative request url in maps
  );

  // Bind authentication configuration to the provider
  const boundProvider = await provider.bind(
    {
      // TODO: Add your auth keys for provider '${provider}' here
    }
  );

  // Perform the map with the given input and return the result as defined in the profile usecase
  const result = await boundProvider.perform(
    // name of the usecase to execute
    '${name}',
    {}
  );

  // TODO: Do something with the result, here we just print in
  console.log(
    "${name}/${provider} result:",
    inspect(result, {
      depth: 5,
      colors: true
    })
  );
}

main()
`;
}

export function pubs(name: string, provider: string): string {
  return `
import * as fs from 'fs';
import { promisify, inspect } from 'util';
import { Provider } from '@superfaceai/sdk'; // The sdk is where the main work is performed

const readFile = promisify(fs.readFile);

async function main() {
  // Load the compiled JSON ASTs from local files
  // These files are compiled when running \`superface play ${name}\` or \`superface compile ${name}.supr ${name}.${provider}.suma\` in the current directory
  const profileAst = JSON.parse(
    await readFile('${name}.supr.ast.json', { encoding: 'utf-8' })
  );
  const mapAst = JSON.parse(
    await readFile('${name}.${provider}.suma.ast.json', { encoding: 'utf-8' })
  );

  // Crate a new provider from local files.
  const provider = new Provider(
    // the loaded ASTs
    profileAst,
    mapAst,
    // base url for relative request url in maps
    // for example, the same Overpass API is mirrored on more servers:
    // https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
    'https://overpass-api.de'
  );

  // Bind authentication configuration to the provider
  const boundProvider = await provider.bind(
    {
      // TODO: Add your auth keys for provider '${provider}' here
      // No keys are needed for OSM
    }
  );

  // Perform the map with the given input and return the result as defined in the profile usecase
  const result = await boundProvider.perform(
    // name of the usecase to execute
    '${name}',
    {
      city: "Praha",
      nameRegex: "Diego"
    },
  );

  // TODO: Do something with the result, here we just print in
  console.log(
    "${name}/${provider} result:",
    inspect(result, {
      depth: 5,
      colors: true
    })
  );
}

main()
`;
}
