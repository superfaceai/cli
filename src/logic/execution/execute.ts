import { spawn } from 'child_process';

import type { ILogger } from '../../common';
import type { UserError } from '../../common/error';
import { executeRunner } from './runner';

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

  await executeRunner(execution, command.command, { userError, logger });
}

function prepareCommand(
  file: string,
  _engine: 'JS' = 'JS'
): { command: string; args: string[] } {
  return {
    command: 'node',
    args: ['--experimental-wasi-unstable-preview1', file],
  };
}

// describe('execute', () => {
//   it('executes integration', async () => {
//     const mockLogger: ILogger = {
//       info: jest.fn(),
//       error: jest.fn(),
//       success: jest.fn(),
//     };
//     const mockUserError: UserError = jest.fn() as any;
//     await execute('src/logic/execute.ts', 'JS', {
//       logger: mockLogger,
//       userError: mockUserError,
//     });
//     expect(mockLogger.info).toHaveBeenCalledWith(
//       'executingCommand',
//       expect.stringContaining('node')
//     );
//   });

//   it('throws when integration fails', async () => {
//     const mockLogger: ILogger = {
//       info: jest.fn(),
//       error: jest.fn(),
//       success: jest.fn(),
//     };
//     const mockUserError: UserError = jest.fn() as any;
//     await expect(
//       execute('src/logic/execute.ts', 'JS', {
//         logger: mockLogger,
//         userError: mockUserError,
//       })
//     ).rejects.toThrowError();
//   }
