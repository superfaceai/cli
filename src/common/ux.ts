import { green, hex, red } from 'chalk';
import type { Spinner } from 'nanospinner';
import { createSpinner } from 'nanospinner';

import { template } from '../common/chalk-template';

const WARN_COLOR = '#B48817';

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
    this.spinner.success({ text: green(template(text)), mark: green('✔') });
  }

  public fail(text: string): void {
    this.spinner.error({ text: red(template(text)), mark: red('✖') });
  }

  public info(text: string): void {
    if (text !== this.lastText) {
      this.spinner.update({ text });
    }

    this.lastText = text;
  }

  public warn(text: string): void {
    this.spinner.warn({
      text: hex(WARN_COLOR)(template(text)),
      mark: hex(WARN_COLOR)('⚠'),
    });
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
