
import * as fs from 'fs';
import * as nodePath from 'path';
import { promisify, inspect } from 'util';
import { Provider } from '@superfaceai/sdk'; // The sdk is where the main work is performed

const readFile = promisify(fs.readFile);

async function main() {
  // Load the compiled JSON ASTs from local files
  // These files are compiled when running `superface play execute playground` or `superface compile --output build playground.supr playground.twillio.suma` in the current directory
  const profileAst = JSON.parse(
    await readFile(nodePath.join('build', 'playground.supr.ast.json'), { encoding: 'utf-8' })
  );
  const mapAst = JSON.parse(
    await readFile(nodePath.join('build', 'playground.twillio.suma.ast.json'), { encoding: 'utf-8' })
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
      // TODO: Add your auth keys for provider 'twillio' here
      // No keys are needed for OSM
    }
  );

  // Perform the map with the given input and return the result as defined in the profile usecase
  const result = await boundProvider.perform(
    // name of the usecase to execute
    'playground',
    {
      city: "Praha",
      nameRegex: "Diego"
    },
  );

  // TODO: Do something with the result, here we just print in
  console.log(
    "playground/twillio result:",
    inspect(result, {
      depth: 5,
      colors: true
    })
  );

}

main()
