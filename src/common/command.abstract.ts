import { Command as OclifCommand, flags } from '@oclif/command';

export abstract class Command extends OclifCommand {
  static flags = {
    quiet: flags.boolean({
      char: 'q',
      description:
        'When set to true, disables the shell echo output.',
      default: false,
    }),
    help: flags.help({ char: 'h' }),
  };
}
