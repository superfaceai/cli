import { MockLogger } from '../../../common';
import { buildSuperfaceDirPath } from '../../../common/file-structure';
import { pythonApplicationCode } from './application-code';

describe('pythonApplicationCode', () => {
  it('should return correct application code', async () => {
    const scope = 'test-scope';
    const name = 'test-name';
    const provider = 'test-provider';
    const useCaseName = 'test-use-case-name';

    const logger = new MockLogger();

    const result = pythonApplicationCode(
      {
        profile: {
          scope,
          name,
        },
        useCaseName,
        provider,
        input: '{}',
        parameters: [],
        security: [],
      },
      { logger }
    );

    expect(result).toEqual({
      code: `import os
from dotenv import load_dotenv
import sys
from one_sdk import OneClient, PerformError, UnexpectedError

load_dotenv()

client = OneClient(
  # Optionally you can use your OneSDK token to monitor your usage. Get one at https://superface.ai/app
  # token =
  # Specify path to assets folder
  assets_path = "${buildSuperfaceDirPath()}"
)

profile = client.get_profile("${scope}/${name}")
use_case = profile.get_usecase("${useCaseName}")
try:
  result = use_case.perform(
    {},
    provider = "${provider}",
    parameters = {},
    security = {}
  )
  print(f"RESULT: {result}")
except Exception as e:
  if isinstance(e, PerformError):
    print(f"ERROR RESULT: {e.error_result}")
  elif isinstance(e, UnexpectedError):
    print(f"ERROR:", e, file=sys.stderr)
  else:
    raise e
finally:
  client.send_metrics_to_superface()`,
      requiredParameters: [],
      requiredSecurity: [],
    });
  });
});
