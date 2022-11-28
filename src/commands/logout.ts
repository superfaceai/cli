import { ServiceClientError } from '@superfaceai/service-client';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { SuperfaceClient } from '../common/http';
import type { ILogger } from '../common/log';

export default class Logout extends Command {
  public static strict = false;

  public static description = 'Logs out logged in user';

  public static args = [];

  public static examples = ['$ superface logout'];

  public async run(): Promise<void> {
    const { flags } = this.parse(Logout);
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
      throw userError(String(error), 1);
    }
  }
}
