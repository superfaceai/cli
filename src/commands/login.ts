import { flags as oclifFlags } from '@oclif/command';
import { Netrc } from 'netrc-parser';

import { Command, Flags } from '../common/command.abstract';
import { UserError } from '../common/error';
import { getServicesUrl, SuperfaceClient } from '../common/http';
import { ILogger } from '../common/log';
import { login } from '../logic/login';

export default class Login extends Command {
  static description = 'Login to superface server';

  static flags = {
    ...Command.flags,
    force: oclifFlags.boolean({
      char: 'f',
      description:
        "When set to true user won't be asked to confirm browser opening",
      default: false,
    }),
  };

  static examples = ['$ superface login', '$ superface login -f'];

  async run(): Promise<void> {
    const { flags } = this.parse(Login);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
    });
  }

  async execute({
    logger,
    userError,
    flags,
  }: {
    logger: ILogger;
    flags: Flags<typeof Login.flags>;
    userError: UserError;
  }): Promise<void> {
    if (process.env.SUPERFACE_REFRESH_TOKEN) {
      logger.warn('usinfSfRefreshToken');
    } else {
      const storeUrl = getServicesUrl();
      //environment variable for specific netrc file
      const netrc = new Netrc(process.env.NETRC_FILEPATH);
      await netrc.load();
      const previousEntry = netrc.machines[storeUrl];
      try {
        //check if already logged in and logout
        if (previousEntry && previousEntry.password) {
          logger.info('alreadyLoggedIn');
          //logout from service client
          await SuperfaceClient.getClient().logout();
        }
      } catch (err) {
        logger.error('unknownError', err);
      }
    }

    await login(
      {
        force: flags.force,
      },
      { logger, userError }
    );

    logger.success('loggedInSuccessfully');
  }
}
