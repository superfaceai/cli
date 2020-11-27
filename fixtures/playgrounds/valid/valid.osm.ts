import * as fs from 'fs';
import { promisify, inspect } from 'util';
import { Provider } from '@superfaceai/sdk';

const readFile = promisify(fs.readFile);

async function main() {
	const profileAst = JSON.parse(
		await readFile('valid.supr.ast.json', { encoding: 'utf-8' })
	);
	const mapAst = JSON.parse(
		await readFile('valid.osm.suma.ast.json', { encoding: 'utf-8' })
	);

	const provider = new Provider(
		profileAst, mapAst,
		'PubOpeningHours',
		'https://overpass-api.de'
	);

	const boundProvider = await provider.bind(
		{
			// TODO: Add your auth keys here
			// No keys are needed for OSM
		}
	);

	const result = await boundProvider.perform(
		{
			city: "Praha",
			nameRegex: "Diego"
		}
	);

	console.log(
		"pubs/OSM result:",
		inspect(result, {
			depth: 5,
			colors: true
		})
	);
}

main()