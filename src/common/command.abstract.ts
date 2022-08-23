import { Command as OclifCommand, flags } from '@oclif/command';
import type * as Parser from '@oclif/parser';

import type { UserError } from './error';
import { createUserError } from './error';
import type { ILogger } from './log';
import { DummyLogger, StdoutLogger } from './log';

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

  public static flags = {
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

  public async initialize(flags: Flags<typeof Command.flags>): Promise<void> {
    if (flags.quiet !== true) {
      this.logger = new StdoutLogger(
        flags.noColor !== true,
        flags.noEmoji !== true
      );
    }

    if (flags.noEmoji === true) {
      this.userError = createUserError(false);
    }
  }
}
