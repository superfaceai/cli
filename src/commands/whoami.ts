import { bold, gray, green, yellow } from 'chalk';

import { Command } from '../common/command.abstract';

export default class Whoami extends Command {
  static strict = false;

  static description = 'Prints info about logged in user';

  static args = [];

  static examples = ['$ superface whoami'];

  private logCallback = (message: string) => this.log(gray(message));
  private warnCallback = (message: string) => this.log(yellow(message));

  async run(): Promise<void> {
    //TODO: err handling?
    const userInfo = this.getUserInfo();
    const accounts = userInfo.accounts
      .map(account => {
        let typeStr: string;
        if (account.type === UserAccountType.PERSONAL) {
          typeStr = 'personal';
        } else {
          this.warnCallback(`⚠️ Unknown user account type`);
          typeStr = 'unknown';
        }

        return `${bold(green(account.handle))}: ${bold(
          green(typeStr)
        )} account`;
      })
      .join('\n');
    this.logCallback(
      `🆗 You are logged in as:\n${bold(
        green(userInfo.name)
      )}\nwith email:\n${bold(green(userInfo.email))}\nacounts:\n${accounts}`
    );
  }

  //TODO: use service client
  private getUserInfo(): UserResponse {
    return {
      name: 'jakub vacek',
      email: 'jakub.vacek@something.com',
      accounts: [
        {
          handle: 'jakub.vacek',
          type: UserAccountType.PERSONAL,
        },
      ],
    };
  }
}

//HACK: use interfaces from service client
export interface UserResponse {
  name: string;
  email: string;
  accounts: UserAccountResponse[];
}

export interface UserAccountResponse {
  handle: string;
  type: UserAccountType;
}

export enum UserAccountType {
  PERSONAL = 'PERSONAL',
}
