import { Command as OclifCommand, flags } from '@oclif/command';
import * as Parser from '@oclif/parser';

import { createUserError, UserError } from './error';
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
  protected logger: ILogger = new DummyLogger();
  protected userError: UserError = createUserError(true);

  static flags = {
    quiet: flags.boolean({
      char: 'q',
      description:
        'When set to true, disables the shell echo output of action.',
      default: false,
    }),
    noColor: flags.boolean({
      description: 'When set to true, disables all colored output.',
      default: false,
    }),
    noEmoji: flags.boolean({
      description: 'When set to true, disables displaying emoji in output.',
      default: false,
    }),
    help: flags.help({ char: 'h' }),
  };

  async initialize(flags: Flags<typeof Command.flags>): Promise<void> {
    if (!flags.quiet) {
      this.logger = new StdoutLogger(!flags.noColor, !flags.noEmoji);
    }

    if (flags.noEmoji) {
      this.userError = createUserError(false);
    }
  }
}
