import type { IntegrationParameter, SecurityScheme } from '@superfaceai/ast';

import { buildSuperfaceDirPath } from '../../../common/file-structure';
import { ProfileId } from '../../../common/profile';
import type { ApplicationCodeWriter } from '../application-code';
import { ONESDK_TOKEN_COMMENT, ONESDK_TOKEN_ENV } from '../dotenv';
import { prepareParameters } from './parameters';
import { prepareSecurity } from './security';

export const pythonApplicationCode: ApplicationCodeWriter = ({
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
  input: string;
  parameters?: IntegrationParameter[];
  security?: SecurityScheme[];
}) => {
  const profileId = ProfileId.fromScopeName(profile.scope, profile.name).id;

  const preparedParameters = prepareParameters(provider, parameters);
  const preparedSecurity = prepareSecurity(provider, security);

  const code = `import os
from dotenv import load_dotenv
import sys
from one_sdk import OneClient, PerformError, UnexpectedError

load_dotenv()

client = OneClient(
  # ${ONESDK_TOKEN_COMMENT}
  token = os.getenv("${ONESDK_TOKEN_ENV}"),
  # Path to Comlinks within your project
  assets_path = "${buildSuperfaceDirPath()}"
)

# Load Comlink profile and use case
profile = client.get_profile("${profileId}")
use_case = profile.get_usecase("${useCaseName}")

try:
  result = use_case.perform(
    ${input},
    provider = "${provider}",
    parameters = ${preparedParameters.parametersString},
    security = ${preparedSecurity.securityString}
  )
  print(f"RESULT: {result}")
except PerformError as e:
  print(f"ERROR RESULT: {e.error_result}")
except UnexpectedError as e:
  print(f"ERROR: {e}", file=sys.stderr)
finally:
  client.send_metrics_to_superface()`;

  return {
    code,
    requiredParameters: preparedParameters.required,
    requiredSecurity: preparedSecurity.required,
  };
};
