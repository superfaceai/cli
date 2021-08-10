import { flags as oclifFlags } from '@oclif/command';
import { bold, green, grey, yellow } from 'chalk';
import { Netrc } from 'netrc-parser';

import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { login } from '../logic/login';

export default class Login extends Command {
  static description = 'Initiate login to superface server';

  //TODO: some flags?
  static flags = {
    ...Command.flags,
    force: oclifFlags.boolean({
      char: 'f',
      description: `When set to true user won't be asked to confirm browser opening`,
      default: false,
    }),
  };
  //TODO: some args

  private warnCallback? = (message: string) =>
    this.log('⚠️  ' + yellow(message));

  private logCallback? = (message: string) => this.log(grey(message));
  private successCallback? = (message: string) =>
    this.log(bold(green(message)));

  async run(): Promise<void> {
    let loggedIn = false;
    const { flags } = this.parse(Login);

    if (flags.quiet) {
      this.warnCallback = undefined;
      this.logCallback = undefined;
      this.successCallback = undefined;
    }

    //TODO: heroku timeouts after 10 minutes - keep it? Or leverage expiresAt?
    setTimeout(() => {
      if (!loggedIn) {
        throw userError('Timed out', 1);
      }
    }, 1000 * 60 * 10).unref();

    if (process.env.SUPERFACE_REFRESH_TOKEN) {
      //TODO: login flow when there is SUPERFACE_REFRESH_TOKEN? setOptions on ServiceClient and store it in netrc?
      throw userError('Cannot log in with SUPERFACE_REFRESH_TOKEN set', 1);
    }

    const netrc = new Netrc();
    await netrc.load();
    //TODO: key name
    const host = 'api.superface.ai';
    const previousEntry = netrc.machines[host];

    try {
      //check if already logged in and logout
      if (previousEntry && previousEntry.password) {
        this.logCallback?.('Already logged in');
        //logout from service client
        SuperfaceClient.getClient().logout();
        //TODO: logout from services
        // await this.logout(previousEntry.password)
      }
    } catch (err) {
      this.warnCallback?.(err);
    }

    const authToken = await login({
      logCb: this.logCallback,
      warnCb: this.warnCallback,
      force: flags.force,
    });

    //TODO: we store credentials in Netrc
    if (!netrc.machines[host]) netrc.machines[host] = {};
    //TODO: how to store AuthToken object
    // netrc.machines[host].login = entry.login
    // netrc.machines[host].password = entry.password
    delete netrc.machines[host].method;
    delete netrc.machines[host].org;
    await netrc.save();
    //save authToken to ServiceClient instance
    SuperfaceClient.getClient().login(authToken);

    loggedIn = true;
    this.successCallback?.('Logged in');
  }
}
