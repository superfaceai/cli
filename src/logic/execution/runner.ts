import type { ChildProcess } from 'child_process';

import type { ILogger } from '../../common';
import type { UserError } from '../../common/error';

export function executeRunner(
  childProcess: ChildProcess,
  command: string,
  { userError, logger }: { userError: UserError; logger: ILogger }
) {
  return new Promise((resolve, reject) => {
    childProcess.stdout?.on('data', output => {
      logger.info('childProcessOutput', String(output));
    });

    childProcess.stderr?.on('data', output => {
      logger.error('childProcessOutput', String(output));
    });

    childProcess.on('close', code => {
      if (code !== 0) {
        logger.error('childProcessExited', code);

        reject(userError(`Failed to execute ${command}`, 1));
      }

      logger.success('childProcessExited', code);

      resolve(undefined);
    });
  });
}
