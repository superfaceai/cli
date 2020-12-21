import { CLIError } from '@oclif/errors';
import { inspect } from 'util';

/**
 * User error.
 *
 * It is a normal occurence to return an user error.
 *
 * Has a positive exit code.
 */
export function userError(message: string, code: number): CLIError {
  if (code <= 0) {
    throw developerError('expected positive error code', 1);
  }

  return new CLIError(message, { exit: code });
}

/**
 * Developer error.
 *
 * It should only be returned from unexpected states and unreachable code.
 *
 * Has a negative exit code.
 */
export function developerError(message: string, code: number): CLIError {
  if (code <= 0) {
    throw developerError('expected positive error code', 1);
  }

  return new CLIError(`Internal error: ${message}`, { exit: -code });
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