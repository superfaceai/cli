import { Command as OclifCommand, flags } from '@oclif/command';
import * as Parser from '@oclif/parser';

import { DummyLogger, ILogger, StdoutLogger } from './log';

type FlagType<T> = T extends Parser.flags.IOptionFlag<infer V>
  ? V
  : T extends Parser.flags.IBooleanFlag<infer V>
  ? V | undefined
  : never;

type KeysOfType<T, SelectedType> = {
  [key in keyof T]: SelectedType extends T[key] ? key : never;
}[keyof T];
type Optional<T> = Partial<Pick<T, KeysOfType<T, undefined>>>;
type NonOptional<T> = Omit<T, KeysOfType<T, undefined>>;
export type OptionalUndefined<T> = Optional<T> & NonOptional<T>;

export type Flags<T> = OptionalUndefined<
  { [key in keyof T]: FlagType<T[key]> }
>;

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

  protected logger: ILogger = new StdoutLogger();

  async initialize(flags: Flags<typeof Command.flags>): Promise<void> {
    if (flags.quiet) {
      this.logger = new DummyLogger();
    }
  }
}
