import { Command as OclifCommand, flags } from '@oclif/command';

import { Logger } from '.';

export abstract class Command extends OclifCommand {
  static flags = {
    quiet: flags.boolean({
      char: 'q',
      description:
        'When set to true, disables the shell echo output of action.',
      default: false,
    }),
    help: flags.help({ char: 'h' }),
  };

  /**
   * Sets up logger for current run of oclif command
   * @param quiet - quiet flag
   */
  public setUpLogger(quiet?: boolean) {
    Logger.setup(quiet);
  }
}
