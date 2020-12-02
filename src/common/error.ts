import { CLIError } from '@oclif/errors';

/**
 * User error.
 *
 * It is a normal occurence to return an user error.
 *
 * Has a positive exit code.
 */
export function userError(message: string, index: number): CLIError {
  if (index <= 0) {
    throw developerError('expected positive error index', 1);
  }

  return new CLIError(message, { exit: index });
}

/**
 * Developer error.
 *
 * It should only be returned from unexpected states and unreachable code.
 *
 * Has a negative exit code.
 */
export function developerError(message: string, index: number): CLIError {
  if (index <= 0) {
    throw developerError('expected positive error index', 1);
  }

  return new CLIError(`Internal error: ${message}`, { exit: -index });
}
