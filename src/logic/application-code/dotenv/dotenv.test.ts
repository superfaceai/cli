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
const TOKEN = 'sfs_b31314b7fc8...8ec1930e';

const EXISTING_DOTENV = `SUPERFACE_ONESDK_TOKEN=sfs_b31314b7fc8...8ec1930e
# Deployment zone
# for AWS
MY_PROVIDER_PARAM_TWO=us-west-1
MY_PROVIDER_TOKEN=
`;

describe('createNewDotenv', () => {
  describe('when there is no previous .env', () => {
    it('creates valid .env when no token, no parameters or security schemes are given', () => {
      const result = createNewDotenv({ providerName: PROVIDER_NAME });

      expect(result).toStrictEqual({
        content: `# Set your OneSDK token to monitor your usage out-of-the-box. Get yours at https://superface.ai/app
SUPERFACE_ONESDK_TOKEN=
`,
        addedEnvVariables: ['SUPERFACE_ONESDK_TOKEN'],
      });
    });

    it('creates valid .env when valid token but no parameters or security schemes are given', () => {
      const result = createNewDotenv({
        providerName: PROVIDER_NAME,
        token: TOKEN,
      });

      expect(result).toStrictEqual({
        content: `# OneSDK token lets your monitor your usage out-of-the-box at https://superface.ai/app
SUPERFACE_ONESDK_TOKEN=sfs_b31314b7fc8...8ec1930e
`,
        addedEnvVariables: ['SUPERFACE_ONESDK_TOKEN'],
      });
    });

    it('creates valid .env when 2 parameters but no security schemes are given', () => {
      const result = createNewDotenv({
        providerName: PROVIDER_NAME,
        parameters: [PARAMETER, PARAMETER_WITH_DEFAULT],
        token: TOKEN,
      });

      expect(result).toStrictEqual({
        content: `# OneSDK token lets your monitor your usage out-of-the-box at https://superface.ai/app
SUPERFACE_ONESDK_TOKEN=sfs_b31314b7fc8...8ec1930e

# Parameter description
MY_PROVIDER_PARAM_ONE=

# Deployment zone
# for AWS
MY_PROVIDER_PARAM_TWO=us-west-1
`,
        addedEnvVariables: [
          'SUPERFACE_ONESDK_TOKEN',
          'MY_PROVIDER_PARAM_ONE',
          'MY_PROVIDER_PARAM_TWO',
        ],
      });
    });

    it('creates valid .env when 2 parameters and 2 security schemes are given', () => {
      const result = createNewDotenv({
        providerName: PROVIDER_NAME,
        parameters: [PARAMETER, PARAMETER_WITH_DEFAULT],
        security: [BASIC_AUTH, BEARER_AUTH],
        token: TOKEN,
      });

      expect(result).toStrictEqual({
        content: `# OneSDK token lets your monitor your usage out-of-the-box at https://superface.ai/app
SUPERFACE_ONESDK_TOKEN=sfs_b31314b7fc8...8ec1930e

# Parameter description
MY_PROVIDER_PARAM_ONE=

# Deployment zone
# for AWS
MY_PROVIDER_PARAM_TWO=us-west-1
MY_PROVIDER_USERNAME=
MY_PROVIDER_PASSWORD=
MY_PROVIDER_TOKEN=
`,
        addedEnvVariables: [
          'SUPERFACE_ONESDK_TOKEN',
          'MY_PROVIDER_PARAM_ONE',
          'MY_PROVIDER_PARAM_TWO',
          'MY_PROVIDER_USERNAME',
          'MY_PROVIDER_PASSWORD',
          'MY_PROVIDER_TOKEN',
        ],
      });
    });
  });

  describe('when there is a previous existing .env', () => {
    it('creates valid .env when no token, no parameters or security schemes are given', () => {
      const result = createNewDotenv({
        previousDotenv: EXISTING_DOTENV,
        providerName: PROVIDER_NAME,
      });

      expect(result).toStrictEqual({
        content: EXISTING_DOTENV,
        addedEnvVariables: [],
      });
    });

    it('creates valid .env when 2 parameters but no security schemes are given', () => {
      const result = createNewDotenv({
        previousDotenv: EXISTING_DOTENV,
        providerName: PROVIDER_NAME,
        parameters: [PARAMETER, PARAMETER_WITH_DEFAULT],
      });

      expect(result).toStrictEqual({
        content: `SUPERFACE_ONESDK_TOKEN=sfs_b31314b7fc8...8ec1930e
# Deployment zone
# for AWS
MY_PROVIDER_PARAM_TWO=us-west-1
MY_PROVIDER_TOKEN=

# Parameter description
MY_PROVIDER_PARAM_ONE=
`,
        addedEnvVariables: ['MY_PROVIDER_PARAM_ONE'],
      });
    });

    it('creates valid .env when 2 parameters and 2 security schemes are given', () => {
      const result = createNewDotenv({
        previousDotenv: EXISTING_DOTENV,
        providerName: PROVIDER_NAME,
        parameters: [PARAMETER, PARAMETER_WITH_DEFAULT],
        security: [BASIC_AUTH, BEARER_AUTH],
      });

      expect(result).toStrictEqual({
        content: `SUPERFACE_ONESDK_TOKEN=sfs_b31314b7fc8...8ec1930e
# Deployment zone
# for AWS
MY_PROVIDER_PARAM_TWO=us-west-1
MY_PROVIDER_TOKEN=

# Parameter description
MY_PROVIDER_PARAM_ONE=
MY_PROVIDER_USERNAME=
MY_PROVIDER_PASSWORD=
`,
        addedEnvVariables: [
          'MY_PROVIDER_PARAM_ONE',
          'MY_PROVIDER_USERNAME',
          'MY_PROVIDER_PASSWORD',
        ],
      });
    });
  });
});