import inquirer from 'inquirer';
import * as open from 'open';

import {
  fetchVerificationUrl,
  initLogin,
  SuperfaceClient,
} from '../common/http';
import { LogCallback } from '../common/log';

export async function login(options?: {
  logCb?: LogCallback;
  warnCb?: LogCallback;
  force?: boolean;
}): Promise<void> {
  //get verification url, browser url and expiresAt
  const initializeLogin = await initLogin();

  //open browser on browser url /auth/cli/browser
  const browserUrl = new URL(initializeLogin.browser_url).href;

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
      `Please open url: ${browserUrl} in your browser to continue with login.`
    );
  };
  if (openBrowser) {
    const childProcess = await open.default(browserUrl, { wait: false });
    childProcess.on('error', err => {
      options?.warnCb?.(err.message);
      showUrl();
    });
    childProcess.on('close', code => {
      if (code !== 0) showUrl();
    });
  } else {
    showUrl();
  }

  //start polling verification url
  const authToken = await fetchVerificationUrl(initializeLogin.verify_url);
  //Save credentials to client instance and netrc
  await SuperfaceClient.getClient().login(authToken);
}
