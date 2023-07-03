import type { ChildProcess } from 'node:child_process';
import { EventEmitter, Readable, Writable } from 'node:stream';

import { MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import { executeRunner } from './runner';

// TODO: finish tests
describe('executeRunner', () => {
  it.skip('executes integration', async () => {
    const mockChildProcess = new EventEmitter() as ChildProcess;

    mockChildProcess.stdin = new Writable({
      write(_data, _enc, callback) {
        callback();
      },
      final(_callback) {
        // mimic the child process exiting
        mockChildProcess.emit('close');
      },
    });

    mockChildProcess.stdout = new Readable({
      read() {
        this.push('      17      18      19');

        this.push(null);
        // collect and verify the data that wc outputs to STDOUT
      },
    });

    mockChildProcess.stderr = new Readable({
      read() {
        // collect and verify the data that wc outputs to STDERR
      },
    });

    const mockLogger = new MockLogger();
    const userError = createUserError(false);

    await executeRunner(mockChildProcess, 'node', {
      logger: mockLogger,
      userError,
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'childProcessExited',
      expect.anything()
    );
  });
});
