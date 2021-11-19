import { ServiceApiError } from '@superfaceai/service-client';

import { Logger } from '../common';
import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { SuperfaceClient } from '../common/http';

export default class Whoami extends Command {
  static strict = true;

  static description = 'Prints info about logged in user';

  static examples = ['$ superface whoami', '$ sf whoami'];

  async run(): Promise<void> {
    const { flags } = this.parse(Whoami);
    this.setUpLogger(flags.quiet);

    try {
      const userInfo = await SuperfaceClient.getClient().getUserInfo();
      Logger.success(
        `You are logged in as: ${userInfo.name} (${userInfo.email})`
      );
    } catch (error) {
      if (!(error instanceof ServiceApiError)) {
        throw userError(error, 1);
      }
      if (error.status === 401) {
        Logger.warn(`You are not logged in. Please try running "sf login"`);
      } else {
        Logger.warn(
          `Superface server responded with error: ${error.name}: ${error.message}`
        );
      }
    }
  }
}
