import type { IntegrationParameter, SecurityScheme } from '@superfaceai/ast';

import type { ILogger } from '../../../common';
import { buildAssetstPath } from '../../../common/file-structure';
import { prepareParametersString } from './parameters';
import { prepareSecurityString } from './security';

export function jsApplicationCode(
  {
    profile,
    useCaseName,
    provider,
    input,
    parameters,
    security,
  }: {
    profile: {
      name: string;
      scope?: string;
    };
    useCaseName: string;
    provider: string;
    // TODO:  more language independent type for input?
    input: string;
    parameters?: IntegrationParameter[];
    security?: SecurityScheme[];
  },
  { logger }: { logger: ILogger }
): string {
  // TODO: revisit this
  const pathToSdk = '@superfaceai/one-sdk/node/index.js';

  const profileId = `${profile.scope !== undefined ? profile.scope + '/' : ''}${
    profile.name
  }`;
  const parametersString = prepareParametersString(provider, parameters, {
    logger,
  });
  const securityString = prepareSecurityString(provider, security, { logger });

  // TODO: make template nicer
  return `import { config } from 'dotenv';
import { OneClient } from '${pathToSdk}';
  
config();
async function main() {
  const client = new OneClient({ assetsPath: '${buildAssetstPath()}' });

  const profile = await client.getProfile('${profileId}');
  const result = await profile
    .getUseCase('${useCaseName}')
    .perform(
    ${input},
      {
        provider: '${provider}',
        parameters: ${parametersString},
        security: ${securityString}
      }
    );

  console.log("RESULT:", JSON.stringify(result, null, 2));

  await new Promise(resolve => setTimeout(() => {
    console.log('all job done, exiting...');
    resolve();
  }, 2000));
}

void main();`;
}
