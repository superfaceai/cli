import type { IntegrationParameter, SecurityScheme } from '@superfaceai/ast';

import type { ILogger } from '../../../common';
import { buildSuperfaceDirPath } from '../../../common/file-structure';
import { ProfileId } from '../../../common/profile';
import type { ApplicationCodeWriter } from '../application-code';
import { prepareParametersString } from '../js/parameters';
import { prepareSecurityString } from '../js/security';

export const pythonApplicationCode: ApplicationCodeWriter = (
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
    input: string;
    parameters?: IntegrationParameter[];
    security?: SecurityScheme[];
  },
  { logger }: { logger: ILogger }
) => {
  const profileId = ProfileId.fromScopeName(profile.scope, profile.name).id;

  const parametersString = prepareParametersString(provider, parameters, {
    logger,
  });
  const securityString = prepareSecurityString(provider, security, { logger });

  return `import os
from dotenv import load_dotenv
from superfaceai.one_sdk import OneClient

load_dotenv()

client = OneClient(
  # Optionally you can use your OneSDK token to monitor your usage. Get one at https://superface.ai/app
  # token =
  # Specify path to assets folder
  assets_path = "${buildSuperfaceDirPath()}"
)

profile = client.get_profile("${profileId}")
use_case = profile.get_usecase("${useCaseName}")
try:
  result = use_case.perform(
    ${input},
    provider = "${provider}",
    parameters = ${parametersString},
    security = ${securityString}
  )
  print(f"RESULT: {result}")
except Exception as e:
  print(f"ERROR: {e}")`;
};
