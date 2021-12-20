import { flags as oclifFlags } from '@oclif/command';
import { bold, green, grey, yellow } from 'chalk';
import { Netrc } from 'netrc-parser';

import { Command } from '../common/command.abstract';
import { getServicesUrl, SuperfaceClient } from '../common/http';
import { login } from '../logic/login';

export default class Login extends Command {
  static description = 'Login to superface server';

  static flags = {
    ...Command.flags,
    force: oclifFlags.boolean({
      char: 'f',
      description: `When set to true user won't be asked to confirm browser opening`,
      default: false,
    }),
  };

  private warnCallback?= (message: string) =>
    this.log('⚠️  ' + yellow(message));

  private logCallback?= (message: string) => this.log(grey(message));
  private successCallback?= (message: string) =>
    this.log(bold(green(message)));

  static examples = ['$ superface login', '$ superface login -f'];

  async run(): Promise<void> {
    const { flags } = this.parse(Login);

    if (flags.quiet) {
      this.warnCallback = undefined;
      this.logCallback = undefined;
      this.successCallback = undefined;
    }

    if (process.env.SUPERFACE_REFRESH_TOKEN) {
      this.warnCallback?.(
        `Using value from SUPERFACE_REFRESH_TOKEN environment variable`
      );
    } else {
      const machine = new URL(getServicesUrl()).host
      console.log('machine', machine)
      //environment variable for specific netrc file
      const netrc = new Netrc(process.env.NETRC_FILEPATH);
      await netrc.load();
      console.log('net', netrc.machines)
      const previousEntry = netrc.machines[machine];

      console.log('entry', previousEntry)
      try {
        //check if already logged in and logout
        if (previousEntry && previousEntry.password) {
          console.log('go')
          this.logCallback?.('⚠️ Already logged in, logging out');
          //logout from service client
          console.log('before')
          await SuperfaceClient.getClient().logout();
        }
      } catch (err) {
        console.log('err', err)
        this.warnCallback?.(err);
      }
    }

    console.log('after')
    await login({
      logCb: this.logCallback,
      warnCb: this.warnCallback,
      force: flags.force,
    });

    this.successCallback?.('🆗 Logged in');
  }
}
