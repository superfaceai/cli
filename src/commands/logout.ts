import { ServiceClientError } from '@superfaceai/service-client';

import { Command, Flags } from '../common/command.abstract';
import { userError } from '../common/error';
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
      flags,
    });
  }

  async execute({
    logger,
    flags: _,
  }: {
    logger: ILogger;
    flags: Flags<typeof Logout.flags>;
  }): Promise<void> {
    try {
      await SuperfaceClient.getClient().signOut();
      logger.success('loggoutSuccessfull');
    } catch (error) {
      if (error instanceof ServiceClientError) {
        logger.warn('superfaceServerError', error.name, error.message);

        return;
      }
      throw userError(error, 1);
    }
  }
}
