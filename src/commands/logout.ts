import { gray, green } from 'chalk';

import { Command } from '../common/command.abstract';
import { logout } from '../logic/logout';

export default class Logout extends Command {
  static strict = false;

  static description = 'Logout logged in user';

  static args = [];

  static examples = ['$ superface logout'];

  private logCallback = (message: string) => this.log(gray(message));
  private successCallback = (message: string) => this.log(green(message));

  async run(): Promise<void> {
    //TODO: err handling?
    await logout({ logCb: this.logCallback });

    this.successCallback(`🆗 You have been logged out`);
  }
}
