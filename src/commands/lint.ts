import { Command, flags } from '@oclif/command';

export default class Lint extends Command {
  static description = 'Lints provided Slang file, lorem ipsum';

  static flags = {
    format: flags.enum({
      options: ['autodetect', 'map', 'profile'],
      char: 'h',
      default: 'autodetect',
    }),
    help: flags.help({ char: 'h' }),
  };

  static args = [{ name: 'file', required: true }];

  async run(): Promise<void> {
    const { args, flags } = this.parse(Lint);
    this.log(`${flags.format}, ${Object.entries(args).join(':')}`);
  }
}
