import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { bold, green, grey, yellow } from 'chalk';
import * as open from 'open'

import Netrc from 'netrc-parser'
import { LogCallback } from '../common/types';
import inquirer from 'inquirer';
import { getStoreUrl } from '../common/http';

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

    await Netrc.load()
    //TODO: key name
    const previousEntry = Netrc.machines['api.heroku.com']

    try {
      //TODO: check if already loged in and logged out
      if (previousEntry && previousEntry.password) {
        this.logCallback?.('Already logged in')
        // await this.logout(previousEntry.password)
      }
    } catch (err) {
      this.warnCallback?.(err)
    }


    await this.login({ logCb: this.logCallback, warnCb: this.warnCallback })
    loggedIn = true
    this.successCallback?.('Logged in')
  }
  async login(options?: {
    logCb?: LogCallback
    warnCb?: LogCallback
  }): Promise<void> {
    //TODO we need to decide if we want to use service-client

    //TODO: post to /auth/cli and verification url
    const browserUrl = new URL(getStoreUrl() + '/auth/cli').href
    //TODO: start polling verification url

    //TODO: open browser on browser url /auth/cli/browser - maybe force flag to skip prompting?
    const prompt: { open: boolean } = await inquirer.prompt({
      name: 'open',
      message: `Do you want to open browser with url: ${browserUrl}.`,
      type: 'confirm',
      default: true,
    });
    const showUrl = () => {
      options?.warnCb?.(`Please open url: ${browserUrl} in your browser to continue with login.`)
    }
    if (!prompt.open) {
      showUrl()
    } else {
      const childProcess = await open.default(browserUrl, { wait: false })
      childProcess.on('error', err => {
        options?.warnCb?.(err.message)
        showUrl()
      })
      childProcess.on('close', code => {
        if (code !== 0) showUrl()
      })
    }
    //TODO: polling should return token that we will save to .netrc and will be added to every api call - service client would halp us with refreshing

  }
}
