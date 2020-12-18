import * as fs from 'fs';
import { promisify, inspect } from 'util';
import { Provider } from '@superfaceai/sdk';

const readFile = promisify(fs.readFile);

async function main() {
	const profileAst = JSON.parse(
		await readFile('valid.supr.ast.json', { encoding: 'utf-8' })
	);
	const mapAst = JSON.parse(
		await readFile('valid.noop.suma.ast.json', { encoding: 'utf-8' })
	);

	const provider = new Provider(
		profileAst, mapAst,
		'PubOpeningHours'
	);

	const boundProvider = await provider.bind(
		{
			// TODO: Add your auth keys here
		}
	);

	const result = await boundProvider.perform(
		{
			city: "Praha",
			nameRegex: "Diego"
		}
	);

	console.log(
		"pubs/Noop result:",
		inspect(result, {
			depth: 5,
			colors: true
		})
	);
}

main()