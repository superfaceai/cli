import { CLIError } from '@oclif/errors';

import {
  assertIsExecError,
  assertIsGenericError,
  assertIsIOError,
  developerError,
  userError,
} from './error';

describe('Error functions', () => {
  describe('when throwing user error', () => {
    it('throws user error correctly', async () => {
      expect(() => {
        throw userError('user error', 1);
      }).toThrow(new CLIError('user error'));
    });

    it('throws developer error on negative exit code', async () => {
      expect(() => {
        throw userError('some error', -1);
      }).toThrow(
        new CLIError('Internal error: expected positive error code', {
          exit: -1,
        })
      );
    });
  });

  describe('when throwing developer error', () => {
    it('throws developer error correctly', async () => {
      expect(() => {
        throw developerError('developer error', 1);
      }).toThrow(new CLIError('Internal error: developer error'));
    });

    it('throws developer error on negative exit code', async () => {
      expect(() => {
        throw developerError('some error', -1);
      }).toThrow(
        new CLIError('Internal error: expected positive error code', {
          exit: -1,
        })
      );
    });
  });

  describe('when asserting error is generic', () => {
    it('throws developer error correctly', async () => {
      expect(() => assertIsGenericError(null)).toThrow(
        new CLIError('Internal error: unexpected error: null')
      );
      expect(() => assertIsGenericError(undefined)).toThrow(
        new CLIError('Internal error: unexpected error: undefined')
      );
      expect(() => assertIsGenericError({})).toThrow(
        new CLIError('Internal error: unexpected error: {}')
      );
      expect(() => assertIsGenericError({ code: 'test' })).toThrow(
        new CLIError("Internal error: unexpected error: { code: 'test' }")
      );
      expect(() => assertIsGenericError({ message: 2 })).toThrow(
        new CLIError('Internal error: unexpected error: { message: 2 }')
      );
    });

    it('does not throw developer error', async () => {
      expect(() => assertIsGenericError({ message: 'test' })).not.toThrow();
    });
  });

  describe('when asserting error is IO error', () => {
    it('throws developer error correctly', async () => {
      expect(() => assertIsIOError(null)).toThrow(
        new CLIError('Internal error: unexpected error: null')
      );
      expect(() => assertIsIOError(undefined)).toThrow(
        new CLIError('Internal error: unexpected error: undefined')
      );
      expect(() => assertIsIOError({})).toThrow(
        new CLIError('Internal error: unexpected error: {}')
      );
      expect(() => assertIsIOError({ code: 2 })).toThrow(
        new CLIError('Internal error: unexpected error: { code: 2 }')
      );
      expect(() => assertIsIOError({ message: 2 })).toThrow(
        new CLIError('Internal error: unexpected error: { message: 2 }')
      );
    });

    it('does not throw developer error', async () => {
      expect(() => assertIsIOError({ code: 'test' })).not.toThrow();
    });
  });

  describe('when asserting error is exec error', () => {
    it('throws developer error correctly', async () => {
      expect(() => assertIsExecError(null)).toThrow(
        new CLIError('Internal error: unexpected error: null')
      );
      expect(() => assertIsExecError(undefined)).toThrow(
        new CLIError('Internal error: unexpected error: undefined')
      );
      expect(() => assertIsIOError({})).toThrow(
        new CLIError('Internal error: unexpected error: {}')
      );
      expect(() => assertIsExecError({ code: 2 })).toThrow(
        new CLIError('Internal error: unexpected error: { code: 2 }')
      );
      expect(() => assertIsExecError({ message: 2 })).toThrow(
        new CLIError('Internal error: unexpected error: { message: 2 }')
      );
      expect(() => assertIsExecError({ stdout: 2 })).toThrow(
        new CLIError('Internal error: unexpected error: { stdout: 2 }')
      );
      expect(() => assertIsExecError({ stderr: 2 })).toThrow(
        new CLIError('Internal error: unexpected error: { stderr: 2 }')
      );
    });

    it('does not throw developer error', async () => {
      expect(() =>
        assertIsExecError({ stderr: 'test', stdout: 'test' })
      ).not.toThrow();
    });
  });
});
