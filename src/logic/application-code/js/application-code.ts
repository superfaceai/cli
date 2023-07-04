import type { IntegrationParameter, SecurityScheme } from '@superfaceai/ast';

import type { ILogger } from '../../../common';
import { buildSuperfaceDirPath } from '../../../common/file-structure';
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

  return `import { config } from 'dotenv';
  // Load OneClient from SDK
  import { OneClient } from '${pathToSdk}';

  // Load environment variables from .env file
  config();
  async function main() {
    const client = new OneClient({
      env = {
        // Specify log level for OneClient
        "ONESDK_DEV_LOG": "trace"
      },
      // Specify path to assets folder
      assetsPath: '${buildSuperfaceDirPath()}'
    });

    // Load profile and use case
    const profile = await client.getProfile('${profileId}');
    const useCase = profile.getUseCase('${useCaseName}')

    try {
      // Execute use case
      const result = await useCase.perform(
        // Use case input
        ${input},
        {
          provider: '${provider}',
          parameters: ${parametersString},
          // Security values for provider
          security: ${securityString}
        }
      );

      console.log("RESULT:", JSON.stringify(result, null, 2));

    } catch (e) {
      console.log("ERROR:", JSON.stringify(e, null, 2));
    }
  }

  void main();`;
}