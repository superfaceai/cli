import { MockLogger } from '../../../common';
import { buildSuperfaceDirPath } from '../../../common/file-structure';
import { jsApplicationCode } from './application-code';

describe('jsApplicationCode', () => {
  it('should return correct application code', async () => {
    const scope = 'test-scope';
    const name = 'test-name';
    const provider = 'test-provider';
    const useCaseName = 'test-use-case-name';

    const logger = new MockLogger();

    const result = jsApplicationCode(
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

    expect(result).toEqual(`import { config } from 'dotenv';
// Load OneClient from SDK
import { OneClient } from '@superfaceai/one-sdk/node/index.js';

// Load environment variables from .env file
config();
async function main() {
  const client = new OneClient({
    // Optionally you can use your OneSDK token to monitor your usage. Get one at https://superface.ai/app
    // token:
    // Specify path to assets folder
    assetsPath: '${buildSuperfaceDirPath()}'
  });

  // Load profile and use case
  const profile = await client.getProfile('${scope}/${name}');
  const useCase = profile.getUseCase('${useCaseName}')

  try {
    // Execute use case
    const result = await useCase.perform(
      // Use case input
      {},
      {
        provider: '${provider}',
        parameters: {},
        // Security values for provider
        security: {}
      }
    );

    console.log("RESULT:", JSON.stringify(result, null, 2));

  } catch (e) {
    console.log("ERROR:", JSON.stringify(e, null, 2));
  }
}

void main();`);
  });
});
