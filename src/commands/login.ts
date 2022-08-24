import { flags as oclifFlags } from '@oclif/command';
import { Netrc } from 'netrc-parser';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { getServicesUrl, SuperfaceClient } from '../common/http';
import type { ILogger } from '../common/log';
import { login } from '../logic/login';

export default class Login extends Command {
  public static description = 'Login to superface server';

  public static flags = {
    ...Command.flags,
    force: oclifFlags.boolean({
      char: 'f',
      description:
        "When set to true user won't be asked to confirm browser opening",
      default: false,
    }),
  };

  public static examples = ['$ superface login', '$ superface login -f'];

  public async run(): Promise<void> {
    const { flags } = this.parse(Login);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
    });
  }

  public async execute({
    logger,
    userError,
    flags,
  }: {
    logger: ILogger;
    flags: Flags<typeof Login.flags>;
    userError: UserError;
  }): Promise<void> {
    if (process.env.SUPERFACE_REFRESH_TOKEN !== undefined) {
      logger.warn('usinfSfRefreshToken');
    } else {
      const storeUrl = getServicesUrl();
      // environment variable for specific netrc file
      const netrc = new Netrc(process.env.NETRC_FILEPATH);
      await netrc.load();
      const previousEntry = netrc.machines[storeUrl];
      try {
        // check if already logged in and logout
        if (
          previousEntry !== undefined &&
          previousEntry.password !== undefined
        ) {
          logger.info('alreadyLoggedIn');
          // logout from service client
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
