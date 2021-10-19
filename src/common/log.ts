import { green, grey, red, yellow } from "chalk";

export type LogCallback = (message: string) => void;


export class Logger {
  public static readonly successPrefix = '🆗'
  public static readonly errorPrefix = '❌'
  public static readonly warningPrefix = '⚠️'
  private static logger: Logger | undefined = undefined
  private quiet: boolean

  private constructor(quiet?: boolean) {
    this.quiet = quiet || false
  }

  public static setup(quiet?: boolean): Logger {
    if (!Logger.logger) {
      Logger.logger = new Logger(quiet)
    }

    return Logger.logger
  }


  public error(input: string): void {
    if (!this.quiet)
      process.stderr.write(red(`${Logger.errorPrefix} ${input}`))
  }

  public info(input: string): void {
    if (!this.quiet)
      process.stdout.write(grey(input))
  }

  public warn(input: string): void {
    if (!this.quiet)
      process.stdout.write(yellow(`${Logger.warningPrefix} ${input}`))
  }

  public success(input: string): void {
    if (!this.quiet)
      process.stdout.write(green(`${Logger.successPrefix} ${input}`))
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
