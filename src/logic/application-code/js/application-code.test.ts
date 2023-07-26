import { MockLogger } from '../../../common';
import { buildSuperfaceDirPath } from '../../../common/file-structure';
import { jsApplicationCode } from './application-code';

jest.mock('../../../common/file-structure');

describe('jsApplicationCode', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return correct application code for unix', async () => {
    jest
      .mocked(buildSuperfaceDirPath)
      .mockReturnValue('/Users/test/cli-test/superface');
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

    expect(result).toEqual({
      code: `import { config } from 'dotenv';
// Load OneClient from SDK
import { OneClient, PerformError, UnexpectedError } from '@superfaceai/one-sdk/node/index.js';

// Load environment variables from .env file
config();

const client = new OneClient({
  // The token for monitoring your Comlinks at https://superface.ai
  token: process.env.SUPERFACE_ONESDK_TOKEN,
  // Path to Comlinks within your project
  assetsPath: '/Users/test/cli-test/superface'
});

// Load Comlink profile and use case
const profile = await client.getProfile('${scope}/${name}');
const useCase = profile.getUseCase('${useCaseName}');

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
  if (e instanceof PerformError) {
    console.log('ERROR RESULT:', e.errorResult);
  } else if (e instanceof UnexpectedError) {
    console.error('ERROR:', e);
  } else {
    throw e;
  }
}
`,
      requiredParameters: [],
      requiredSecurity: [],
    });
  });

  it('should return correct application code for windows', async () => {
    jest
      .mocked(buildSuperfaceDirPath)
      .mockReturnValue('C:\\Users\\my\\cli-test\\superface');
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

    expect(result).toEqual({
      code: `import { config } from 'dotenv';
// Load OneClient from SDK
import { OneClient, PerformError, UnexpectedError } from '@superfaceai/one-sdk/node/index.js';

// Load environment variables from .env file
config();

const client = new OneClient({
  // The token for monitoring your Comlinks at https://superface.ai
  token: process.env.SUPERFACE_ONESDK_TOKEN,
  // Path to Comlinks within your project
  assetsPath: 'C:\\\\Users\\\\my\\\\cli-test\\\\superface'
});

// Load Comlink profile and use case
const profile = await client.getProfile('${scope}/${name}');
const useCase = profile.getUseCase('${useCaseName}');

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
  if (e instanceof PerformError) {
    console.log('ERROR RESULT:', e.errorResult);
  } else if (e instanceof UnexpectedError) {
    console.error('ERROR:', e);
  } else {
    throw e;
  }
}
`,
      requiredParameters: [],
      requiredSecurity: [],
    });
  });
});
