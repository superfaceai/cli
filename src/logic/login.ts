import { VerificationStatus } from '@superfaceai/service-client';
import inquirer from 'inquirer';
import * as open from 'open';

import { userError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { LogCallback } from '../common/log';

export async function login(options?: {
  logCb?: LogCallback;
  warnCb?: LogCallback;
  force?: boolean;
}): Promise<void> {
  const client = SuperfaceClient.getClient();
  //get verification url, browser url and expiresAt
  const initResponse = await client.cliLogin();

  if (!initResponse.success) {
    throw userError(
      `Attempt to login ended with: ${initResponse.title}${initResponse.detail ? `: ${initResponse.detail}` : ''
      }`,
      1
    );
  }
  //open browser on browser url /auth/cli/browser

  let openBrowser = true;
  if (!options?.force) {
    const prompt: { open: boolean } = await inquirer.prompt({
      name: 'open',
      message: `Do you want to open browser with superface login page?`,
      type: 'confirm',
      default: true,
    });
    openBrowser = prompt.open;
  }
  const showUrl = () => {
    options?.warnCb?.(
      `Please open url: ${initResponse.browserUrl} in your browser to continue with login.`
    );
  };
  if (openBrowser && !options?.force) {
    const childProcess = await open.default(initResponse.browserUrl, {
      wait: false,
    });
    childProcess.on('error', err => {
      options?.warnCb?.(err.message);
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

  //poll verification url
  const verifyResponse = await client.verifyCliLogin(initResponse.verifyUrl);
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
  //Save credentials to client instance and netrc
  await SuperfaceClient.getClient().login(verifyResponse.authToken);
}
