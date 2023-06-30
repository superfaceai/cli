import { green, red, yellow } from 'chalk';
import type { Spinner } from 'nanospinner';
import { createSpinner } from 'nanospinner';

// TODO: This could be singleton that is injectet into each command class as dependency and there is a helper methot to get instance from user error handler - on error we need to call fail method
export class UX {
  private readonly spinner: Spinner;

  constructor() {
    this.spinner = createSpinner(undefined, { color: 'cyan' });
  }

  public start(text: string): void {
    if (!text.endsWith('\n')) {
      text += '\n';
    }
    this.spinner.start({ text });
  }

  public succeed(text: string): void {
    if (!text.endsWith('\n')) {
      text += '\n';
    }
    this.spinner.success({ text: green(text), mark: green('✔') });
  }

  public fail(text: string): void {
    if (!text.endsWith('\n')) {
      text += '\n';
    }
    this.spinner.error({ text: red(text), mark: red('✖') });
  }

  public info(text: string): void {
    if (!text.endsWith('\n')) {
      text += '\n';
    }
    this.spinner.update({ text });
  }

  public warn(text: string): void {
    if (!text.endsWith('\n')) {
      text += '\n';
    }
    this.spinner.warn({ text: yellow(text), mark: yellow('⚠') });
  }
}
