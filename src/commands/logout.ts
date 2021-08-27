import { flags as oclifFlags } from '@oclif/command';
import { bold, gray, green, yellow } from 'chalk';

import { Command } from '../common/command.abstract';
import { logout } from '../logic/logout';

export default class Logout extends Command {
  static strict = false;

  static description = 'Logout logged in user';

  static args = [];

  static examples = ['$ superface logout'];

  private logCallback = (message: string) => this.log(gray(message));
  private warnCallback = (message: string) => this.log(yellow(message));

  async run(): Promise<void> {
    //TODO: err handling?
    await logout()

    this.logCallback(
      `🆗 You are logged in as:\n${bold(
        green(userInfo.name)
      )}\nwith email:\n${bold(green(userInfo.email))}\nacounts:\n${accounts}`
    );
  }
}

