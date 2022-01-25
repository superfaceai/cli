/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { EXTENSIONS, ProviderJson } from '@superfaceai/ast';
import { AuthToken, CLILoginResponse } from '@superfaceai/service-client';
import { execFile } from 'child_process';
import concat from 'concat-stream';
import { Headers, Response } from 'cross-fetch';
import { Mockttp } from 'mockttp';
import { constants } from 'os';
import { join as joinPath, relative } from 'path';

import { DEFAULT_PROFILE_VERSION_STR } from '../common/document';
import { ContentType } from '../common/http';
import { mkdir, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';

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
    await readFile(basePath + '.json', { encoding: 'utf-8' })
  );
  const profileSource = await readFile(basePath + EXTENSIONS.profile.source, {
    encoding: 'utf-8',
  });
  const profileAST = JSON.parse(
    await readFile(basePath + EXTENSIONS.profile.build, { encoding: 'utf-8' })
  );
  await server
    .get('/' + profile)
    .withHeaders({ Accept: ContentType.JSON })
    .thenJson(200, profileInfo);
  await server
    .get('/' + profile)
    .withHeaders({ Accept: ContentType.PROFILE_SOURCE })
    .thenReply(200, profileSource, {
      'Content-Type': ContentType.PROFILE_SOURCE,
    });
  await server
    .get('/' + profile)
    .withHeaders({ Accept: ContentType.PROFILE_AST })
    .thenJson(200, profileAST, { 'Content-Type': ContentType.PROFILE_AST });
}

/**
 * Mocks HTTP responses for a map
 *
 * expects following files in specified path (default fixtures/profiles)
 *   [profileScope]/maps/[provider].[profileName].suma             - map source
 *   [profileScope]/maps/[provider].[profileName].suma.ast.json    - compiled map source
 */
export async function mockResponsesForMap(
  server: Mockttp,
  profile: {
    scope?: string;
    name: string;
    version?: string;
  },
  provider: string,
  mapVariant?: string,
  path = joinPath('fixtures', 'profiles')
): Promise<void> {
  const url = `${profile.scope ? `${profile.scope}/` : ''}${
    profile.name
  }.${provider}${mapVariant ? `.${mapVariant}` : ''}@${
    profile.version ? profile.version : DEFAULT_PROFILE_VERSION_STR
  }`;

  const basePath = profile.scope
    ? joinPath(path, profile.scope, 'maps', `${provider}.${profile.name}`)
    : joinPath(path, profile.name, 'maps', `${provider}.${profile.name}`);

  const mapInfo = JSON.parse(
    await readFile(basePath + '.json', { encoding: 'utf-8' })
  );

  const mapSource = await readFile(basePath + EXTENSIONS.map.source, {
    encoding: 'utf-8',
  });
  const mapAST = await readFile(basePath + EXTENSIONS.map.build, {
    encoding: 'utf-8',
  });

  await server
    .get('/' + url)
    .withHeaders({ Accept: ContentType.JSON })
    .thenReply(200, mapInfo);

  await server
    .get('/' + url)
    .withHeaders({ Accept: ContentType.MAP_SOURCE })
    .thenReply(200, mapSource, { 'Content-Type': ContentType.MAP_SOURCE });

  await server
    .get('/' + url)
    .withHeaders({ Accept: ContentType.MAP_AST })
    .thenReply(200, mapAST, { 'Content-Type': ContentType.MAP_AST });
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
    await readFile(basePath + '.json', { encoding: 'utf-8' })
  );

  const mockProviderResponse = {
    provider_id: 'test',
    url: 'url/to/provider',
    owner: 'your-moma',
    owner_url: 'path/to/your/moma',
    published_at: new Date(),
    published_by: 'your-popa',
    definition: providerInfo,
  };

  await server
    .get('/providers/' + provider)
    .withHeaders({ 'Content-Type': ContentType.JSON })
    .thenJson(200, mockProviderResponse);
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
  const providersInfo: { definition: ProviderJson }[] = [];
  for (const p of providers) {
    const basePath = joinPath(path, p);
    providersInfo.push({
      definition: JSON.parse(
        await readFile(basePath + '.json', { encoding: 'utf-8' })
      ),
    });
  }
  await server
    .get('/providers')
    .withQuery({ profile: profile })
    .withHeaders({ 'Content-Type': ContentType.JSON })
    .thenJson(200, { data: providersInfo });
}

/**
 * Mocks HTTP responses for a publishing endpoint
 */
export async function mockResponsesForPublish(server: Mockttp): Promise<void> {
  await server
    .post('/providers')
    .withHeaders({ 'Content-Type': ContentType.JSON })
    .thenJson(200, {});

  await server
    .post('/profiles')
    .withHeaders({ 'Content-Type': ContentType.TEXT })
    .thenJson(200, {});

  await server
    .post('/maps')
    .withHeaders({ 'Content-Type': ContentType.TEXT })
    .thenJson(200, {});
}
/**

* Mocks HTTP responses for login
*
* mocks /auth/cli and /auth/cli/verify paths
*/
export async function mockResponsesForLogin(
  server: Mockttp,
  mockInitLoginResponse: CLILoginResponse,
  mockVerifyResponse:
    | {
        authToken: AuthToken;
      }
    | {
        statusCode: number;
        errStatus: string;
      }
): Promise<void> {
  if (mockInitLoginResponse.success) {
    await server.post('/auth/cli').thenJson(201, {
      verify_url: mockInitLoginResponse.verifyUrl,
      browser_url: mockInitLoginResponse.browserUrl,
      expires_at: mockInitLoginResponse.expiresAt.toDateString(),
    });
  } else {
    await server.post('/auth/cli').thenJson(200, mockInitLoginResponse);
  }

  if ('authToken' in mockVerifyResponse) {
    await server
      .get('/auth/cli/verify')
      .withQuery({ token: 'stub' })
      .thenJson(200, mockVerifyResponse.authToken);
  } else {
    await server
      .get('/auth/cli/verify')
      .withQuery({ token: 'stub' })
      .thenJson(mockVerifyResponse.statusCode, {
        status: mockVerifyResponse.errStatus,
      });
  }
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

    childProcess.on('error', (err: Error) => {
      reject(err);
    });

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
export async function setUpTempDir(
  path: string,
  withNetrc = false
): Promise<string> {
  const randomDigits = Math.floor(Math.random() * 100000).toString();
  const directory = joinPath(path, `test-${randomDigits}`);
  await mkdir(directory, { recursive: true });
  //set mock .netrc
  if (withNetrc) {
    await OutputStream.writeOnce(joinPath(directory, '.netrc'), '');
  }

  return directory;
}

/**
 * Creates a command instance
 */
export function CommandInstance<T>(command: new (...args: any[]) => T): T {
  const instance = new command([], {} as any);

  return instance;
}
