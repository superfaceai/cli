import { inspect } from 'util';

import { SuperfaceClient } from '@superfaceai/sdk';

/** Execute one specific pair of profile and map. */
async function execute(
  scope: string | undefined,
  name: string,
  providerName: string
) {
  let profileId = name;
  if (scope !== undefined) {
    profileId = scope + '/' + name;
  }

  // 0. Create the client
  const client = new SuperfaceClient();

  // 1. Get profile from the client (as specified in super.json)
  const profile = await client.getProfile(profileId);

  // 2. Get provider from the client (as configured in super.json)
  const provider = await client.getProvider(providerName);

  // 3. Get usecase from the profile and execute it with the given provider
  const result = await profile.getUseCase('PubOpeningHours').perform(
    {
      city: "Praha",
      nameRegex: "Diego"
    },
    { provider }
  );

  // Do something with the result
  // Here we just print it
  console.log(
    `PubOpeningHours/${providerName} result:`,
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
      provider
    );
  }
}

main();
