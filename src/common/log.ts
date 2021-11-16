import { CLIError } from '@oclif/errors';
import { green, grey, red, yellow } from 'chalk';

export type LogCallback = (message: string) => void;

interface ILogger {
  log(input: string): void;
  error(input: string): void;
}
class StdoutLogger implements ILogger {
  log(input: string): void {
    process.stdout.write(input);
  }

  error(input: string): void {
    process.stdout.write(input);
  }
}

class DummyLogger implements ILogger {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  log(_input: string): void { }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  error(_input: string): void { }
}

export class MockLogger implements ILogger {
  private stdout: string[];
  private stderr: string[];

  constructor() {
    this.stdout = [];
    this.stderr = [];
  }

  get stdoutOutput(): string[] {
    return this.stdout;
  }

  get stderrOutput(): string[] {
    return this.stderr;
  }

  log(input: string): void {
    this.stdout.push(input);
  }

  error(input: string): void {
    this.stderr.push(input);
  }
}

/**
 * Represents logger used in one command lifecycle. For every command run new ILogger instance is created.
 */
export class Logger {
  public static readonly successPrefix = '🆗';
  public static readonly errorPrefix = '❌';
  public static readonly warningPrefix = '⚠️';
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
    const mock = new MockLogger()
    Logger.logger = mock;
    
return mock
  }

  private static getInstance(): ILogger {
    if (!Logger.logger) {
      throw new CLIError('Logger not initialized', { exit: 1 });
    }

    return Logger.logger;
  }

  public static error(input: string): void {
    Logger.getInstance().error(red(`${Logger.errorPrefix} ${input}`) + '\n');
  }

  public static info(input: string): void {
    Logger.getInstance().log(grey(input) + '\n');
  }

  public static warn(input: string): void {
    Logger.getInstance().log(yellow(`${Logger.warningPrefix} ${input}`) + '\n');
  }

  public static success(input: string): void {
    Logger.getInstance().log(green(`${Logger.successPrefix} ${input}`) + '\n');
  }
}

export function formatShellLog(
  initial: string | undefined,
  quoted?: string[],
  env?: Record<string, string>
): string {
  let envString = '';
  if (env !== undefined) {
    envString =
      Object.entries(env)
        .map(([key, value]) => `${key}='${value}'`)
        .join(' ') + ' ';
  }

  let quotedString = '';
  if (quoted !== undefined && quoted.length !== 0) {
    quotedString = quoted.map(q => `'${q}'`).join(' ');
  }

  let initialString = (initial ?? '').trim();
  if (initialString !== '' && quotedString !== '') {
    initialString = initialString + ' ';
  }

  return `$ ${envString}${initialString}${quotedString}`;
}
