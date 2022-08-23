import { VerificationStatus } from '@superfaceai/service-client';
import inquirer from 'inquirer';
import * as open from 'open';

import type { UserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import type { ILogger } from '../common/log';

export async function login(
  { force }: { force?: boolean },
  { logger, userError }: { logger: ILogger; userError: UserError }
): Promise<void> {
  const client = SuperfaceClient.getClient();
  // get verification url, browser url and expiresAt
  const initResponse = await client.cliLogin();

  if (!initResponse.success) {
    throw userError(
      `Attempt to login ended with: ${initResponse.title}${
        initResponse.detail !== undefined ? `: ${initResponse.detail}` : ''
      }`,
      1
    );
  }
  // open browser on browser url /auth/cli/browser

  let openBrowser = true;
  if (force !== true) {
    const prompt: { open: boolean } = await inquirer.prompt({
      name: 'open',
      message: 'Do you want to open browser with Superface login page?',
      type: 'confirm',
      default: true,
    });
    openBrowser = prompt.open;
  }
  const showUrl = () => {
    logger.warn('openUrl', initResponse.browserUrl);
  };
  if (openBrowser && force !== true) {
    const childProcess = await open.default(initResponse.browserUrl, {
      wait: false,
    });
    childProcess.on('error', err => {
      logger.error('errorMessage', err.message);
      showUrl();
    });
    childProcess.on('close', code => {
      if (code !== 0) {
        showUrl();
      }
    });
  } else {
    showUrl();
  }

  // poll verification url
  const verifyResponse = await client.verifyCliLogin(initResponse.verifyUrl, {
    pollingTimeoutSeconds: 3600,
  });
  if (verifyResponse.verificationStatus !== VerificationStatus.CONFIRMED) {
    throw userError(
      `Unable to get auth token, request ended with status: ${verifyResponse.verificationStatus}`,
      1
    );
  }
  if (!verifyResponse.authToken) {
    throw userError(
      `Request ended with status: ${verifyResponse.verificationStatus} but does not contain auth token`,
      1
    );
  }
}
