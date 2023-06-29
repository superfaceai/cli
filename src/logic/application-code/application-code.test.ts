import { MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import { buildAssetsPath } from '../../common/file-structure';
import { writeApplicationCode } from './application-code';

describe('writeApplicationCode', () => {
  const logger = new MockLogger();
  const userError = createUserError(false);

  const name = 'test-name';
  const scope = 'test-scope';
  const useCaseName = 'TestUseCase';

  it('should return correct application code', async () => {
    const result = await writeApplicationCode(
      {
        providerJson: {
          name: 'test',
          defaultService: 'test',
          services: [
            {
              baseUrl: 'https://test.com',
              id: 'test',
            },
          ],
          securitySchemes: [],
          parameters: [],
        },
        profile: {
          source: `name = "${scope}/${name}"
          version = "1.0.1"
          
  usecase ${useCaseName} {
    input {
      id! number!
    }

    result {
      name! string!
    }

    error {
      code number!
    }

    example InputExample {
      input {
        id = 1
      }
      result {
        name = "test"
      }
    }
  }
`,
          name,
          scope,
        },
        useCaseName,
      },
      { logger, userError }
    );

    expect(result).toEqual(`import { config } from 'dotenv';
import { OneClient } from '@superfaceai/one-sdk/node/index.js';
  
config();
async function main() {
  const client = new OneClient({ assetsPath: '${buildAssetsPath()}' });

  const profile = await client.getProfile('${scope}/${name}');
  const result = await profile
    .getUseCase('${useCaseName}')
    .perform(
     {
        id: 1,
      },
      {
        provider: 'test',
        parameters: {},
        security: {}
      }
    );

  console.log("RESULT:", JSON.stringify(result, null, 2));

  await new Promise(resolve => setTimeout(() => {
    console.log('all job done, exiting...');
    resolve();
  }, 2000));
}

void main();`);
  });
});
