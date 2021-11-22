import { ServiceClientError } from '@superfaceai/service-client';

import { Logger } from '..';
import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { SuperfaceClient } from '../common/http';

export default class Logout extends Command {
  static strict = false;

  static description = 'Logs out logged in user';

  static args = [];

  static examples = ['$ superface logout'];

  async run(): Promise<void> {
    const { flags } = this.parse(Logout);
    this.setUpLogger(flags.quiet);

    try {
      await SuperfaceClient.getClient().signOut();
      Logger.success('loggoutSuccessfull');
    } catch (error) {
      if (error instanceof ServiceClientError) {
        Logger.warn('superfaceServerError', error.name, error.message);

        return;
      }
      throw userError(error, 1);
    }
  }
}
