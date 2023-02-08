import { ServiceApiError } from '@superfaceai/service-client';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import type { ILogger } from '../common/log';

export default class Whoami extends Command {
  public static strict = true;

  public static description = 'Prints info about logged in user';

  public static examples = ['$ superface whoami', '$ sf whoami'];

  public async run(): Promise<void> {
    const { flags } = this.parse(Whoami);
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
        throw userError(String(error), 1);
      }
      if (error.status === 401) {
        logger.warn('notLoggedIn');
      } else {
        logger.warn('superfaceServerError', error.name, error.message);
      }
    }
  }
}
