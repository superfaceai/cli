import { green, red, yellow } from 'chalk';
import type { Spinner } from 'nanospinner';
import { createSpinner } from 'nanospinner';

export class UX {
  private static instance: UX | undefined;

  private readonly spinner: Spinner;

  private lastText = '';

  private constructor() {
    this.spinner = createSpinner(undefined, { color: 'cyan', interval: 25 });
    UX.instance = this;
  }

  public start(text: string): void {
    this.lastText = '';
    this.spinner.start({ text });
  }

  public succeed(text: string): void {
    this.spinner.success({ text: green(text), mark: green('✔') });
  }

  public fail(text: string): void {
    this.spinner.error({ text: red(text), mark: red('✖') });
  }

  public info(text: string): void {
    if (text !== this.lastText) {
      this.spinner.update({ text });
    }

    this.lastText = text;
  }

  public warn(text: string): void {
    this.spinner.warn({ text: yellow(text), mark: yellow('⚠') });
  }

  public static create(): UX {
    if (UX.instance === undefined) {
      UX.instance = new UX();
    }

    return UX.instance;
  }

  public static clear(): void {
    UX.instance?.spinner.stop();
  }
}
