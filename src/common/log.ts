import { green, grey, red, yellow } from 'chalk';

import { MessageArgs, MessageKeys, messages } from './messages';

export interface ILogger {
  info<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void;
  warn<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void;
  success<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void;
  error<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void;
}

export class StdoutLogger implements ILogger {
  private readonly successPrefix = '🆗';
  private readonly errorPrefix = '❌';
  private readonly warningPrefix = '⚠️';

  info<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void {
    const message = this.getMessage(template, ...args);
    process.stdout.write(this.formatInfo(message));
  }

  success<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void {
    const message = this.getMessage(template, ...args);
    process.stdout.write(this.formatSuccess(message));
  }

  warn<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void {
    const message = this.getMessage(template, ...args);
    process.stdout.write(this.formatWarn(message));
  }

  error<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void {
    const message = this.getMessage(template, ...args);
    process.stderr.write(this.formatError(message));
  }

  private formatInfo(input: string): string {
    return grey(input) + '\n';
  }

  private formatSuccess(input: string): string {
    return green(`${this.successPrefix} ${input}`) + '\n';
  }

  private formatWarn(input: string): string {
    return yellow(`${this.warningPrefix} ${input}`) + '\n';
  }

  private formatError(input: string): string {
    return red(`${this.errorPrefix} ${input}`) + '\n';
  }

  private getMessage<K extends MessageKeys>(
    messsageTemplate: K,
    ...args: MessageArgs<K>
  ): string {
    return (messages[messsageTemplate] as (
      ...args: (string | unknown | number)[]
    ) => string)(...args);
  }
}

/* eslint-disable @typescript-eslint/no-empty-function */
export class DummyLogger implements ILogger {
  info<K extends MessageKeys>(_template: K, ..._args: MessageArgs<K>): void {}
  success<K extends MessageKeys>(_template: K, ..._arg: MessageArgs<K>): void {}
  warn<K extends MessageKeys>(_template: K, ..._args: MessageArgs<K>): void {}
  error<K extends MessageKeys>(_template: K, ..._args: MessageArgs<K>): void {}
}
/* eslint-enable @typescript-eslint/no-empty-function */

export class MockLogger implements ILogger {
  public stdout: Array<
    [message: MessageKeys, args: MessageArgs<MessageKeys>]
  > = [];

  public stderr: Array<
    [message: MessageKeys, args: MessageArgs<MessageKeys>]
  > = [];

  info<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void {
    this.stdout.push([template, args]);
  }

  success<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void {
    this.stdout.push([template, args]);
  }

  warn<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void {
    this.stdout.push([template, args]);
  }

  error<K extends MessageKeys>(template: K, ...args: MessageArgs<K>): void {
    this.stderr.push([template, args]);
  }
}
