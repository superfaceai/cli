/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ProviderJson } from '@superfaceai/one-sdk';
import { execFile } from 'child_process';
import concat from 'concat-stream';
import { Headers, Response } from 'cross-fetch';
import { Mockttp } from 'mockttp';
import { constants } from 'os';
import { join as joinPath, relative } from 'path';

import { EXTENSIONS } from '../common/document';
import { ContentType } from '../common/http';
import { mkdir, readFile } from '../common/io';

export const ENTER = '\x0D';
export const SPACE = '\x20';
export const UP = '\x1B\x5B\x41';
export const DOWN = '\x1B\x5B\x42';

/**
 * Mocks HTTP responses for a profile
 *
 * expects following files in specified path (default fixtures/profiles)
 *   profileScope/profileName.supr           - profile source
 *   profileScope/profileName.supr.ast.json  - compiled profile source
 *   profileScope/profileName.json           - profile info
 */
export async function mockResponsesForProfile(
  server: Mockttp,
  profile: string,
  path = joinPath('fixtures', 'profiles')
): Promise<void> {
  const basePath = joinPath(path, profile);
  const profileInfo = JSON.parse(
    (await readFile(basePath + '.json')).toString()
  );
  const profileSource = (
    await readFile(basePath + EXTENSIONS.profile.source)
  ).toString();
  const profileAST = JSON.parse(
    (await readFile(basePath + EXTENSIONS.profile.build)).toString()
  );
  await server
    .get('/' + profile)
    .withHeaders({ Accept: ContentType.JSON })
    .thenJson(200, profileInfo);
  await server
    .get('/' + profile)
    .withHeaders({ Accept: ContentType.PROFILE })
    .thenReply(200, profileSource, { ContentType: ContentType.PROFILE });
  await server
    .get('/' + profile)
    .withHeaders({ Accept: ContentType.AST })
    .thenJson(200, profileAST, { 'Content-Type': ContentType.AST });
}

/**
 * Mocks HTTP responses for a provider
 *
 * expects following files in specified path (default fixtures/providers)
 *   provider.json           - provider info
 */
export async function mockResponsesForProvider(
  server: Mockttp,
  provider: string,
  path = joinPath('fixtures', 'providers')
): Promise<void> {
  const basePath = joinPath(path, provider);
  const providerInfo = JSON.parse(
    (await readFile(basePath + '.json')).toString()
  );

  await server
    .get('/providers/' + provider)
    .withHeaders({ Accept: ContentType.JSON })
    .thenJson(200, providerInfo);
}

/**
 * Mocks HTTP responses for a profile providers
 *
 * expects following files in specified path (default fixtures/providers)
 *   provider.json           - provider info
 */
export async function mockResponsesForProfileProviders(
  server: Mockttp,
  providers: string[],
  profile: string,
  path = joinPath('fixtures', 'providers')
): Promise<void> {
  const providersInfo: ProviderJson[] = [];
  for (const p of providers) {
    const basePath = joinPath(path, p);
    providersInfo.push(
      JSON.parse((await readFile(basePath + '.json')).toString())
    );
  }
  await server
    .get('/providers')
    .withQuery({ profile: profile })
    .withHeaders({ Accept: ContentType.JSON })
    .thenJson(200, { data: providersInfo });
}

/**
 * Executes the Superface CLI binary
 *
 * @export
 * @param {string} directory - the directory in which the process runs
 * @param {string[]} args - arguments of the process
 * @param {string} apiUrl - the API URL (to be overriden with mock)
 * @param {object}  options - additional options
 * @returns  {Promise<string>} - result is concatenated stdout
 */
export async function execCLI(
  directory: string,
  args: string[],
  apiUrl: string,
  options?: {
    inputs?: { value: string; timeout: number }[];
    env?: NodeJS.ProcessEnv;
    debug?: boolean;
  }
): Promise<{ stdout: string }> {
  const maxTimeout = 30000;
  const CLI = joinPath('.', 'bin', 'superface');
  const bin = relative(directory, CLI);

  const childProcess = execFile(bin, args, {
    cwd: directory,
    env: { ...process.env, ...options?.env, SUPERFACE_API_URL: apiUrl },
  });

  childProcess.stdin?.setDefaultEncoding('utf-8');

  let currentInputTimeout: NodeJS.Timeout, killIOTimeout: NodeJS.Timeout;

  // Creates a loop to feed user inputs to the child process in order to get results from the tool
  const loop = (userInputs: { value: string; timeout: number }[]) => {
    if (killIOTimeout) {
      clearTimeout(killIOTimeout);
    }

    if (!userInputs.length) {
      childProcess.stdin?.end();

      // Set a timeout to wait for CLI response. If CLI takes longer than
      // maxTimeout to respond, kill the childProcess and notify user
      killIOTimeout = setTimeout(() => {
        console.error('Error: Reached I/O timeout');
        childProcess.kill(constants.signals.SIGTERM);
      }, maxTimeout);

      return;
    }

    currentInputTimeout = setTimeout(() => {
      childProcess.stdin?.write(userInputs[0].value);
      // Log debug I/O statements on tests
      if (options?.debug) {
        console.log(
          `\n\ninput: ${formatInput(userInputs[0].value)} \ntimeout: ${
            userInputs[0].timeout
          }\n user inputs: ${userInputs
            .map(input => formatInput(input.value))
            .join(', ')}\n\n`
        );
      }
      loop(userInputs.slice(1));
    }, userInputs[0].timeout);
  };

  function formatInput(input: string): string {
    let inputString;
    if (input === ENTER) {
      inputString = 'ENTER';
    } else if (input === UP) {
      inputString = 'UP';
    } else if (input === DOWN) {
      inputString = 'DOWN';
    } else if (input === SPACE) {
      inputString = 'SPACE';
    } else if (input === '') {
      inputString = 'EMPTY';
    } else {
      inputString = input;
    }

    return inputString;
  }

  return new Promise((resolve, reject) => {
    //Debug
    if (options?.debug) {
      childProcess.stdout?.on('data', chunk => process.stdout.write(chunk));
      childProcess.stderr?.on('data', chunk => process.stderr.write(chunk));
    }

    childProcess.stderr?.once('data', (err: string | Buffer) => {
      childProcess.stdin?.end();

      if (currentInputTimeout) {
        clearTimeout(currentInputTimeout);
      }
      reject(err.toString());
    });

    childProcess.on('error', (err: Error) => reject(err));

    // Kick off the process
    loop(options?.inputs ?? []);

    childProcess.stdout?.pipe(
      concat(result => {
        if (killIOTimeout) {
          clearTimeout(killIOTimeout);
        }

        resolve({ stdout: result.toString() });
      })
    );
  });
}

/**
 * Retruns mock Response with passed data
 */
export function mockResponse(
  status: number,
  statusText: string,
  headers?: Record<string, string>,
  data?: Record<string, unknown> | Buffer | string
): Response {
  const ResponseInit = {
    status,
    statusText,
    headers: new Headers(headers),
  };

  return new Response(data ? JSON.stringify(data) : undefined, ResponseInit);
}
/**
 * Creates a random directory in `path` and returns the path
 */
export async function setUpTempDir(path: string): Promise<string> {
  const randomDigits = Math.floor(Math.random() * 100000).toString();
  const directory = joinPath(path, `test-${randomDigits}`);
  await mkdir(directory, { recursive: true });

  return directory;
}
