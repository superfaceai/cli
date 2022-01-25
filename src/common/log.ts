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

  constructor(
    private readonly color: boolean,
    private readonly emoji: boolean
  ) {}

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
    const message = this.color ? grey(input) : input;

    return message + '\n';
  }

  private formatSuccess(input: string): string {
    const message = this.emoji ? `${this.successPrefix} ${input}` : input;

    return (this.color ? green(message) : message) + '\n';
  }

  private formatWarn(input: string): string {
    const message = this.emoji ? `${this.warningPrefix} ${input}` : input;

    return (this.color ? yellow(message) : message) + '\n';
  }

  private formatError(input: string): string {
    const message = this.emoji ? `${this.errorPrefix} ${input}` : input;

    return (this.color ? red(message) : message) + '\n';
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
