import { Command, flags } from '@oclif/command';

export default abstract class extends Command {
  static flags = {
    quiet: flags.boolean({
      char: 'q',
      description:
        'When set to true, disables the shell echo output of init actions.',
      default: false,
    }),
    help: flags.help({ char: 'h' }),
  };
}
