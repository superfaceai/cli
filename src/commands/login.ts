import { flags as oclifFlags } from '@oclif/command';
import { Netrc } from 'netrc-parser';

import { Command } from '../common/command.abstract';
import { getServicesUrl, SuperfaceClient } from '../common/http';
import { Logger } from '../common/log';
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

  static examples = ['$ superface login', '$ superface login -f'];

  async run(): Promise<void> {
    const { flags } = this.parse(Login);
    this.setUpLogger(flags.quiet);

    if (process.env.SUPERFACE_REFRESH_TOKEN) {
      Logger.warn(
        `Using value from SUPERFACE_REFRESH_TOKEN environment variable`
      );
    } else {
      const storeUrl = getServicesUrl();
      //environment variable for specific netrc file
      const netrc = new Netrc(process.env.NETRC_FILEPATH);
      await netrc.load();
      const previousEntry = netrc.machines[storeUrl];
      try {
        //check if already logged in and logout
        if (previousEntry && previousEntry.password) {
          Logger.info('Already logged in, logging out');
          //logout from service client
          await SuperfaceClient.getClient().logout();
        }
      } catch (err) {
        Logger.error(err);
      }
    }

    await login({
      force: flags.force,
    });

    Logger.success('Logged in');
  }
}
