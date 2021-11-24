import { ServiceApiError } from '@superfaceai/service-client';

import { Command, Flags } from '../common/command.abstract';
import { userError } from '../common/error';
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
      flags,
    });
  }

  async execute({
    logger,
    flags: _,
  }: {
    logger: ILogger;
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
