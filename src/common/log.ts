import { CLIError } from '@oclif/errors';
import { green, grey, red, yellow } from 'chalk';

import { messages } from './messages';

interface ILogger {
  info(input: string): void;
  warn(input: string): void;
  success(input: string): void;
  error(input: string): void;
}
class StdoutLogger implements ILogger {
  public static readonly successPrefix = '🆗';
  public static readonly errorPrefix = '❌';
  public static readonly warningPrefix = '⚠️';

  info(input: string): void {
    process.stdout.write(grey(input) + '\n');
  }

  success(input: string): void {
    process.stdout.write(
      green(`${StdoutLogger.successPrefix} ${input}`) + '\n'
    );
  }

  warn(input: string): void {
    process.stdout.write(
      yellow(`${StdoutLogger.warningPrefix} ${input}`) + '\n'
    );
  }

  error(input: string): void {
    process.stdout.write(red(`${StdoutLogger.errorPrefix} ${input}`) + '\n');
  }
}

class DummyLogger implements ILogger {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  info(_input: string): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  success(_input: string): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  warn(_input: string): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  error(_input: string): void {}
}

export class MockLogger implements ILogger {
  private stdout: string[];
  private stderr: string[];

  constructor() {
    this.stdout = [];
    this.stderr = [];
  }

  get stdoutOutput(): string {
    return this.stdout.join(' ');
  }

  get stderrOutput(): string {
    return this.stderr.join(' ');
  }

  info(input: string): void {
    this.stdout.push(input);
  }

  success(input: string): void {
    this.stdout.push(input);
  }

  warn(input: string): void {
    this.stderr.push(input);
  }

  error(input: string): void {
    this.stderr.push(input);
  }
}

/**
 * Represents logger used in one command lifecycle. For every command run new ILogger instance is created.
 */
export class Logger {
  private static logger: ILogger | undefined = undefined;

  public static setup(quiet?: boolean): void {
    if (!Logger.logger) {
      if (!quiet) {
        Logger.logger = new StdoutLogger();
      } else {
        Logger.logger = new DummyLogger();
      }
    }
  }

  /**
   * Sets up Logger with MockLogger instance, useful in tests of logic where Logger is used.
   * @returns instance of MockLogger
   */
  public static mockLogger(): MockLogger {
    const mock = new MockLogger();
    Logger.logger = mock;

    return mock;
  }

  private static getInstance(): ILogger {
    if (!Logger.logger) {
      throw new CLIError('Logger not initialized', { exit: 1 });
    }

    return Logger.logger;
  }

  private static getMessage<K extends keyof typeof messages>(
    messsageTemplate: K,
    ...args: Parameters<typeof messages[K]>
  ): string {
    return (messages[messsageTemplate] as (
      ...args: (string | unknown | number)[]
    ) => string)(...args);
  }

  public static error<K extends keyof typeof messages>(
    messsageTemplate: K,
    ...args: Parameters<typeof messages[K]>
  ): void {
    Logger.getInstance().error(Logger.getMessage(messsageTemplate, ...args));
  }

  public static info<K extends keyof typeof messages>(
    messsageTemplate: K,
    ...args: Parameters<typeof messages[K]>
  ): void {
    Logger.getInstance().info(Logger.getMessage(messsageTemplate, ...args));
  }

  public static warn<K extends keyof typeof messages>(
    messsageTemplate: K,
    ...args: Parameters<typeof messages[K]>
  ): void {
    Logger.getInstance().warn(Logger.getMessage(messsageTemplate, ...args));
  }

  public static success<K extends keyof typeof messages>(
    messsageTemplate: K,
    ...args: Parameters<typeof messages[K]>
  ): void {
    Logger.getInstance().success(Logger.getMessage(messsageTemplate, ...args));
  }
}
