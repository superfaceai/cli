/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { execFile } from 'child_process';
import { Mockttp } from 'mockttp';
import { join as joinPath, relative } from 'path';
import { promisify } from 'util';

import { EXTENSIONS } from '../common/document';
import { ContentType } from '../common/http';
import { mkdir, readFile } from '../common/io';

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
 * Executes the Superface CLI binary
 *
 * @export
 * @param {string} directory - the directory in which the process runs
 * @param {string[]} args - arguments of the process
 * @param {string} apiUrl - the API URL (to be overriden with mock)
 * @param {NodeJS.ProcessEnv} [env] - any additional environment variables
 * @returns  {Promise<string>} - result is concatenated stdout
 */
export async function execCLI(
  directory: string,
  args: string[],
  apiUrl: string,
  env?: NodeJS.ProcessEnv
): Promise<{ stderr: string; stdout: string }> {
  const CLI = joinPath('.', 'bin', 'superface');
  const bin = relative(directory, CLI);

  const execCLI = promisify(execFile);

  const result = await execCLI(bin, args, {
    cwd: directory,
    env: { ...process.env, ...env, SUPERFACE_API_URL: apiUrl },
  });

  return result;
  // console.log(result);

  // const subprocess = spawn(bin, args, {
  //   cwd: directory,
  //   env: { ...env, SUPERFACE_API_URL: apiUrl },
  // });
  // subprocess.stdin.setDefaultEncoding('utf-8');

  // return new Promise((resolve, reject) => {
  //   subprocess.stderr.once('data', reject);
  //   subprocess.on('error', reject);
  //   subprocess.stdout.pipe(concat(result => resolve(result.toString())));
  // });
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
