const { inspect } = require('util');
const { Provider } = require('@superfaceaione-sdk');

async function execute(characterName) {
    // 1. Create the provider object - the build artifacts are located by the sdk according to super.json
    const provider = new Provider('starwars/character-information', 'swapidev-ela');
    // 2. Bind the provider - values are taken from super.json unless overridden here
    const boundProvider = await provider.bind();
    // 3. Perform the usecase with the bound provider - defaults are taken from super.json again
    const result = await boundProvider.perform('RetrieveCharacterInformation', { characterName });
    // Do something with the result
    console.log(`starwars/character-information/swapidev-ela result:`, inspect(result, {
        depth: 5,
        colors: true,
    }));
}

execute(process.argv[2]);
