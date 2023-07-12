import type { IntegrationParameter, SecurityScheme } from '@superfaceai/ast';
import { HttpScheme, SecurityType } from '@superfaceai/ast';

import { createNewDotenv } from './dotenv';

const PROVIDER_NAME = 'my-provider';
const PARAMETER: IntegrationParameter = {
  name: 'param-one',
  description: 'Parameter description',
};
const PARAMETER_WITH_DEFAULT: IntegrationParameter = {
  name: 'param-two',
  default: 'us-west-1',
  description: 'Deployment zone\nfor AWS',
};
const BASIC_AUTH: SecurityScheme = {
  id: 'basic_auth',
  type: SecurityType.HTTP,
  scheme: HttpScheme.BASIC,
};
const BEARER_AUTH: SecurityScheme = {
  id: 'bearer_auth',
  type: SecurityType.HTTP,
  scheme: HttpScheme.BEARER,
};

describe('createNewDotenv', () => {
  describe('when there is no previous .env', () => {
    it('creates valid .env when no parameters or security schemes are given', () => {
      const result = createNewDotenv({ providerName: PROVIDER_NAME });

      expect(result).toStrictEqual({
        content: '',
        addedEnvVariables: [],
      });
    });

    it('creates valid .env when 2 parameters but no security schemes are given', () => {
      const result = createNewDotenv({
        providerName: PROVIDER_NAME,
        parameters: [PARAMETER, PARAMETER_WITH_DEFAULT],
      });

      expect(result).toStrictEqual({
        content: `# Parameter description
MY_PROVIDER_PARAM_ONE=

# Deployment zone
# for AWS
MY_PROVIDER_PARAM_TWO=us-west-1
`,
        addedEnvVariables: ['MY_PROVIDER_PARAM_ONE', 'MY_PROVIDER_PARAM_TWO'],
      });
    });

    it('creates valid .env when 2 parameters and 2 security schemes are given', () => {
      const result = createNewDotenv({
        providerName: PROVIDER_NAME,
        parameters: [PARAMETER, PARAMETER_WITH_DEFAULT],
        security: [BASIC_AUTH, BEARER_AUTH],
      });

      expect(result).toStrictEqual({
        content: `# Parameter description
MY_PROVIDER_PARAM_ONE=

# Deployment zone
# for AWS
MY_PROVIDER_PARAM_TWO=us-west-1
MY_PROVIDER_USERNAME=
MY_PROVIDER_PASSWORD=
MY_PROVIDER_TOKEN=
`,
        addedEnvVariables: [
          'MY_PROVIDER_PARAM_ONE',
          'MY_PROVIDER_PARAM_TWO',
          'MY_PROVIDER_USERNAME',
          'MY_PROVIDER_PASSWORD',
          'MY_PROVIDER_TOKEN',
        ],
      });
    });
  });
});
