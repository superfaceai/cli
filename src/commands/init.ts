import { Command, flags } from '@oclif/command';
import { grey } from 'chalk';

import { initSuperface } from '../logic/init';

export default class Init extends Command {
  static description = 'Initializes superface local folder structure.';

  static flags = {
    quiet: flags.boolean({
      char: 'q',
      description:
        'When set to true, disables the shell echo output of init actions.',
      default: false,
    }),
    help: flags.help({ char: 'h' }),
  };

  static args = [
    {
      name: 'path',
      description: 'Path where to initialize folder structure.',
      required: false,
    },
  ];

  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Init);

    if (flags.quiet) {
      this.logCallback = undefined;
    }

    await initSuperface(args.path ?? './', {}, {}, {
      logCb: this.logCallback,
    });
  }
}
