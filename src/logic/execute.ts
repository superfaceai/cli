import { spawn } from 'child_process';

import type { ILogger } from '../common';
import type { UserError } from '../common/error';

export async function execute(
  file: string,
  engine: 'JS' = 'JS',
  { userError, logger }: { userError: UserError; logger: ILogger }
): Promise<void> {
  const command = prepareCommand(file, engine);

  logger.info(
    'executingCommand',
    `${command.command} ${command.args.join(' ')}`
  );

  const execution = spawn(command.command, command.args, {
    stdio: 'inherit',
    env: {
      ...process.env,
    },
  });

  execution.stdout?.on('data', output => {
    logger.info('childProcessOutput', String(output));
  });

  execution.stderr?.on('data', output => {
    logger.error('childProcessOutput', String(output));
  });

  execution.on('close', code => {
    if (code !== 0) {
      logger.error('childProcessExited', code);

      throw userError(`Failed to execute ${file}`, 1);
    }

    logger.success('childProcessExited', code);

    return Promise.resolve();
  });
}

function prepareCommand(
  file: string,
  _engine: 'JS' = 'JS',
): { command: string; args: string[] } {
  return {
    command: 'node',
    args: ['--experimental-wasi-unstable-preview1', file],
  };

}
