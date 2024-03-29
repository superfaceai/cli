import { CLIError } from '@oclif/errors';
import { inspect } from 'util';

import { VERSION } from '../index';
import { template } from './chalk-template';
import { UX } from './ux';

/**
 * User error.
 *
 * It is a normal occurence to return an user error.
 *
 * Has a positive exit code.
 */
export const createUserError =
  (emoji = true, addSuffix = true) =>
  (message: string, code: number): CLIError => {
    // Make sure that UX is stoped before throwing an error.
    UX.clear();

    if (code <= 0) {
      throw developerError('expected positive error code', 1);
    }

    let final = message;

    if (addSuffix) {
      final =
        final +
        template(`\n\nIf you need help with this error, please raise an issue on GitHub Discussions: {underline.bold https://sfc.is/discussions}

Please include the following information:
- command you ran
- error message
- version of the CLI, OS: superface cli/${VERSION} (${process.platform}-${process.arch}) ${process.release.name}-${process.version}
`);
    }

    return new CLIError(emoji ? '❌ ' + final : final, {
      exit: code,
    });
  };
export type UserError = ReturnType<typeof createUserError>;

/**
 * Developer error.
 *
 * It should only be returned from unexpected states and unreachable code.
 *
 * Has a negative exit code (the parameter `code` must be positive).
 */
export function developerError(message: string, code: number): CLIError {
  if (code <= 0) {
    throw developerError('expected positive error code', 1);
  }

  return new CLIError(`❌ Internal error: ${message}`, { exit: -code });
}

export function assertIsGenericError(
  error: unknown
): asserts error is { message: string } {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: Record<string, any> = error;
    if (typeof err.message === 'string') {
      return;
    }
  }

  throw developerError(`unexpected error: ${inspect(error)}`, 101);
}
export function assertIsIOError(
  error: unknown
): asserts error is { code: string } {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: Record<string, any> = error;
    if (typeof err.code === 'string') {
      return;
    }
  }

  throw developerError(`unexpected error: ${inspect(error)}`, 102);
}
export function assertIsExecError(
  error: unknown
): asserts error is { stdout: string; stderr: string } {
  if (typeof error === 'object' && error !== null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: Record<string, any> = error;
    if (typeof err.stdout === 'string' && typeof err.stderr === 'string') {
      return;
    }
  }

  throw developerError(`unexpected error: ${inspect(error)}`, 103);
}

export function stringifyError(error: unknown): string {
  try {
    if (error instanceof Error) {
      const plainObject: Record<string, unknown> = {};
      Object.getOwnPropertyNames(error).forEach(function (key) {
        plainObject[key] = error[key as keyof Error];
      });

      return JSON.stringify(plainObject, null, 2);
    }
  } catch (e) {
    void e;
  }

  return inspect(error, true, null, true);
}
