import {
  AuthToken,
  MEDIA_TYPE_JSON,
  ServiceApiError,
  ServiceApiErrorResponse,
} from '@superfaceai/service-client';
import { bold, green, grey, yellow } from 'chalk';
import inquirer from 'inquirer';
import { Netrc } from 'netrc-parser';
import * as open from 'open';

import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { getStoreUrl, SuperfaceClient } from '../common/http';
import { LogCallback } from '../common/types';

export default class Login extends Command {
  static description = 'Initiate login to superface server';

  //TODO: some flags?
  static flags = {
    ...Command.flags,
  };
  //TODO: some args

  private warnCallback?= (message: string) =>
    this.log('⚠️  ' + yellow(message));

  private logCallback?= (message: string) => this.log(grey(message));
  private successCallback?= (message: string) =>
    this.log(bold(green(message)));

  async run(): Promise<void> {
    let loggedIn = false;
    const { flags } = this.parse(Login);

    if (flags.quiet) {
      this.warnCallback = undefined;
      this.logCallback = undefined;
      this.successCallback = undefined;
    }

    //TODO: heroku timeouts after 10 minutes - keep it?
    setTimeout(() => {
      if (!loggedIn) {
        throw userError('Timed out', 1);
      }
    }, 1000 * 60 * 10).unref();

    //TODO: env variable name
    if (process.env.SUPERFACE_API_KEY) {
      throw userError('Cannot log in with SUPERFACE_API_KEY set', 1);
    }

    const netrc = new Netrc();
    await netrc.load();
    //TODO: key name
    const host = 'api.heroku.com';
    const previousEntry = netrc.machines[host];

    try {
      //Tcheck if already logged in and logout
      if (previousEntry && previousEntry.password) {
        this.logCallback?.('Already logged in');
        //logout form service client
        SuperfaceClient.getClient().logout();
        //TODO: logout fron services
        // await this.logout(previousEntry.password)
      }
    } catch (err) {
      this.warnCallback?.(err);
    }

    const authToken = await this.login({
      logCb: this.logCallback,
      warnCb: this.warnCallback,
    });
    loggedIn = true;
    this.successCallback?.('Logged in');

    //TODO: we store credentials in Netrc
    if (!netrc.machines[host]) netrc.machines[host] = {};
    //TODO: how to store AuthToken
    // netrc.machines[host].login = entry.login
    // netrc.machines[host].password = entry.password
    delete netrc.machines[host].method;
    delete netrc.machines[host].org;
    await netrc.save();
    //save authToken to ServiceClient instance
    SuperfaceClient.getClient().login(authToken);
  }

  async login(options?: {
    logCb?: LogCallback;
    warnCb?: LogCallback;
  }): Promise<AuthToken> {
    //post to /auth/cli and verification url
    const initLoginResponse = await SuperfaceClient.getClient().fetch(
      '/auth/cli',
      { method: 'POST', headers: { 'Content-Type': MEDIA_TYPE_JSON } }
    );
    if (!initLoginResponse.ok) {
      //TODO: use userError
      const errorResponse = (await initLoginResponse.json()) as ServiceApiErrorResponse;
      throw new ServiceApiError(errorResponse);
    }

    const initLogin = (await initLoginResponse.json()) as {
      verify_url: string;
    };

    //open browser on browser url /auth/cli/browser - maybe force flag to skip prompting?
    const browserUrl = new URL(getStoreUrl() + '/auth/cli/browser').href;
    const prompt: { open: boolean } = await inquirer.prompt({
      name: 'open',
      message: `Do you want to open browser with url: ${browserUrl}.`,
      type: 'confirm',
      default: true,
    });
    const showUrl = () => {
      options?.warnCb?.(
        `Please open url: ${browserUrl} in your browser to continue with login.`
      );
    };
    if (!prompt.open) {
      showUrl();
    } else {
      const childProcess = await open.default(browserUrl, { wait: false });
      childProcess.on('error', err => {
        options?.warnCb?.(err.message);
        showUrl();
      });
      childProcess.on('close', code => {
        if (code !== 0) showUrl();
      });
    }
    //start polling verification url
    const fetchAuth = async (retries = 3): Promise<AuthToken> => {
      try {
        const authResponse = await SuperfaceClient.getClient().fetch(
          initLogin.verify_url,
          { method: 'GET', headers: { 'Content-Type': MEDIA_TYPE_JSON } }
        );

        if (!authResponse.ok) {
          //TODO: use userError
          const errorResponse = (await authResponse.json()) as ServiceApiErrorResponse;
          throw new ServiceApiError(errorResponse);
        }

        return (await authResponse.json()) as AuthToken;
      } catch (err) {
        //TODO: err resolution
        if (retries > 0 && err instanceof ServiceApiError && err.status > 500)
          return fetchAuth(retries - 1);
        throw err;
      }
    };

    return fetchAuth();
  }
}
