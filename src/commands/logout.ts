import { ServiceClientError } from '@superfaceai/service-client';

import { Command, Flags } from '../common/command.abstract';
import { UserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import { ILogger } from '../common/log';

export default class Logout extends Command {
  static strict = false;

  static description = 'Logs out logged in user';

  static args = [];

  static examples = ['$ superface logout'];

  async run(): Promise<void> {
    const { flags } = this.parse(Logout);
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
    flags: Flags<typeof Logout.flags>;
  }): Promise<void> {
    try {
      await SuperfaceClient.getClient().signOut();
      logger.success('loggoutSuccessful');
    } catch (error) {
      if (error instanceof ServiceClientError) {
        logger.warn('superfaceServerError', error.name, error.message);

        return;
      }
      throw userError(error, 1);
    }
  }
}
