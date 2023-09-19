import type { IntegrationParameter, SecurityScheme } from '@superfaceai/ast';

import { buildSuperfaceDirPath } from '../../../common/file-structure';
import { ProfileId } from '../../../common/profile';
import type { ApplicationCodeWriter } from '../application-code';
import { ONESDK_TOKEN_COMMENT, ONESDK_TOKEN_ENV } from '../dotenv';
import { prepareParameters } from './parameters';
import { prepareSecurity } from './security';

export const jsApplicationCode: ApplicationCodeWriter = ({
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
}) => {
  const pathToSdk = '@superfaceai/one-sdk';

  const profileId = ProfileId.fromScopeName(profile.scope, profile.name).id;

  const preparedParameters = prepareParameters(provider, parameters);
  const preparedSecurity = prepareSecurity(provider, security);

  const code = `import { config } from "dotenv";
// Load OneClient from SDK
import {
  OneClient,
  PerformError,
  UnexpectedError,
  ValidationError,
} from "${pathToSdk}";

// Load environment variables from .env file
config();

const client = new OneClient({
  // ${ONESDK_TOKEN_COMMENT}
  token: process.env.${ONESDK_TOKEN_ENV},
  // Path to Comlinks within your project
  assetsPath: "${escapeAssetspath(buildSuperfaceDirPath())}",
});

// Load Comlink profile and use case
const profile = await client.getProfile("${profileId}");
const useCase = profile.getUseCase("${useCaseName}");

try {
  // Execute use case
  const result = await useCase.perform(
    // Use case input
    ${input},
    {
      provider: "${provider}",
      parameters: ${preparedParameters.parametersString},
      // Security values for provider
      security: ${preparedSecurity.securityString},
    }
  );

  console.log("RESULT:", JSON.stringify(result, null, 2));
} catch (e) {
  if (e instanceof PerformError) {
    console.log("ERROR RESULT:", e.errorResult);
  } else if (e instanceof ValidationError) {
    console.error("VALIDATION ERROR:", e.message);
  } else if (e instanceof UnexpectedError) {
    console.error("ERROR:", e);
  } else {
    throw e;
  }
}
`;

  return {
    code,
    requiredParameters: preparedParameters.required,
    requiredSecurity: preparedSecurity.required,
  };
};

function escapeAssetspath(path: string): string {
  // Escape backslashes for Windows
  return path.replace(/\\/g, '\\\\');
}
