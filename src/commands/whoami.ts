import { ServiceApiError } from '@superfaceai/service-client';
import { bold, gray, green, yellow } from 'chalk';

import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { SuperfaceClient } from '../common/http';

export default class Whoami extends Command {
  static strict = true;

  static description = 'Prints info about logged in user';

  static examples = ['$ superface whoami', '$ sf whoami'];

  private logCallback = (message: string) => this.log(gray(message));
  private warnCallback = (message: string) => this.log(yellow(message));

  async run(): Promise<void> {
    try {
      const userInfo = await SuperfaceClient.getClient().getUserInfo();
      this.logCallback(
        `🆗 You are logged in as: ${bold(green(userInfo.name))} (${bold(
          green(userInfo.email)
        )})`
      );
    } catch (error) {
      if (!(error instanceof ServiceApiError)) {
        throw userError(error, 1);
      }
      if (error.status === 401) {
        this.warnCallback(
          `❌ You are not logged in. Please try running "sf login"`
        );
      } else {
        this.warnCallback(
          `⚠️ Superface server responded with error: ${error.name}: ${error.message}`
        );
      }
    }
  }
}
