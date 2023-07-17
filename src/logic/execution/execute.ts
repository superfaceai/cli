import { spawn } from 'child_process';

import type { ILogger } from '../../common';
import type { UserError } from '../../common/error';
import type { SupportedLanguages } from '../application-code';
import { executeRunner } from './runner';

export async function execute(
  file: string,
  language: SupportedLanguages,
  { userError, logger }: { userError: UserError; logger: ILogger }
): Promise<void> {
  const command = prepareCommand(file, language);

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
  language: SupportedLanguages
): { command: string; args: string[] } {
  const COMMAND_MAP: {
    [key in SupportedLanguages]: { command: string; args: string[] };
  } = {
    js: {
      command: 'node',
      args: ['--no-warnings', '--experimental-wasi-unstable-preview1', file],
    },
    python: {
      command: 'python3',
      args: [file],
    },
  };

  return COMMAND_MAP[language];
}
