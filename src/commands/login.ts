import { flags as oclifFlags } from '@oclif/command';
import { bold, green, grey, yellow } from 'chalk';
import { Netrc } from 'netrc-parser';

import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { getStoreUrl, SuperfaceClient } from '../common/http';
import { saveNetrc, SUPERFACE_NETRC_HOST } from '../common/netrc';
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

    //TODO: heroku timeouts after 10 minutes - keep it?
    setTimeout(() => {
      if (!loggedIn) {
        throw userError('Timed out', 1);
      }
    }, 1000 * 60 * 10).unref();

    if (process.env.SUPERFACE_REFRESH_TOKEN) {
      this.warnCallback?.(`Using value from SUPERFACE_REFRESH_TOKEN`);
      //TODO: login flow when there is SUPERFACE_REFRESH_TOKEN? Store it in netrc and left service-client to use it, what about baseUrl?
      await saveNetrc(getStoreUrl(), process.env.SUPERFACE_REFRESH_TOKEN);
    } else {
      const netrc = new Netrc();
      await netrc.load();
      const previousEntry = netrc.machines[SUPERFACE_NETRC_HOST];

      try {
        //check if already logged in and logout
        if (
          previousEntry &&
          previousEntry.password &&
          'baseUrl' in previousEntry
        ) {
          //TODO: do not log out if logged in?
          this.logCallback?.('Already logged in, logging out');
          //logout from service client - make this part of CLI logout command
          await SuperfaceClient.getClient().logout();
          //TODO: logout from services
          // await this.logout(previousEntry.password)
        }
      } catch (err) {
        this.warnCallback?.(err);
      }
    }

    const authToken = await login({
      logCb: this.logCallback,
      warnCb: this.warnCallback,
      force: flags.force,
    });

    //save authToken to ServiceClient instance Or this is handled by service client or http functions?
    await SuperfaceClient.getClient().login(authToken);

    loggedIn = true;
    this.successCallback?.('Logged in');
  }
}
