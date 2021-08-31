import { green } from 'chalk';

import { Command } from '../common/command.abstract';
import { SuperfaceClient } from '../common/http';

export default class Logout extends Command {
  static strict = false;

  static description = 'Logout logged in user';

  static args = [];

  static examples = ['$ superface logout'];

  // private logCallback = (message: string) => this.log(gray(message));
  private successCallback = (message: string) => this.log(green(message));

  async run(): Promise<void> {

    try {
      const info = await SuperfaceClient.getClient().getUserInfo()
      console.log('info', info)
      await SuperfaceClient.getClient().signOut()
      this.successCallback(`🆗 You have been logged out`);

    } catch (error) {

      console.log('error', error)

    }


  }
}
