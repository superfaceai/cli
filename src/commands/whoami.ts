import { ServiceApiError } from '@superfaceai/service-client';

import { Command, Flags } from '../common/command.abstract';
import { UserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { ILogger } from '../common/log';

export default class Whoami extends Command {
  static strict = true;

  static description = 'Prints info about logged in user';

  static examples = ['$ superface whoami', '$ sf whoami'];

  async run(): Promise<void> {
    const { flags } = this.parse(Whoami);
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
    flags: _,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Whoami.flags>;
  }): Promise<void> {
    try {
      const userInfo = await SuperfaceClient.getClient().getUserInfo();
      logger.success('loggedInAs', userInfo.name, userInfo.email);
    } catch (error) {
      if (!(error instanceof ServiceApiError)) {
        throw userError(error, 1);
      }
      if (error.status === 401) {
        logger.warn('notLoggedIn');
      } else {
        logger.warn('superfaceServerError', error.name, error.message);
      }
    }
  }
}
