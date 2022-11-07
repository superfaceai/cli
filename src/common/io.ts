import * as childProcess from 'child_process';
import * as fs from 'fs';
import { basename } from 'path';
import rimrafCallback from 'rimraf';
import type { Writable } from 'stream';
import { promisify } from 'util';

import { assertIsIOError } from './error';
import type { SkipFileType } from './flags';

export const access = promisify(fs.access);
export const mkdir = promisify(fs.mkdir);
export const readFile = promisify(fs.readFile);
export const readdir = promisify(fs.readdir);
export const realpath = promisify(fs.realpath);
export const rimraf = promisify(rimrafCallback);
export const rmdir = promisify(fs.rmdir);
export const stat = promisify(fs.stat);
export const execShell = promisify(childProcess.exec);

export interface WritingOptions {
  append?: boolean;
  force?: boolean;
  dirs?: boolean;
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
  } catch (err: unknown) {
    assertIsIOError(err);

    // Allow `ENOENT` because it answers the question.
    if (err.code === 'ENOENT') {
      return false;
    }

    // Rethrow other errors.
    throw err;
  }

  // No error, no problem.
  return true;
}

/**
 * Reads a file and converts to string.
 * Returns `undefined` if reading fails for any reason.
 */
export async function readFileQuiet(path: string): Promise<string | undefined> {
  try {
    const file = await readFile(path, { encoding: 'utf8' });

    return file.toString();
  } catch (_) {
    return undefined;
  }
}

/**
 * Creates a directory without erroring if it already exists.
 * Returns `true` if the directory was created.
 */
export async function mkdirQuiet(path: string): Promise<boolean> {
  try {
    await mkdir(path);
  } catch (err: unknown) {
    assertIsIOError(err);

    // Allow `EEXIST` because scope directory already exists.
    if (err.code === 'EEXIST') {
      return false;
    }

    // Rethrow other errors.
    throw err;
  }

  return true;
}

/**
 * Returns `true` if the given path is a file.
 *
 * Uses the `stat` syscall (follows symlinks) and ignores the `ENOENT` error (non-existent file just returns `false`).
 */
export async function isFileQuiet(path: string): Promise<boolean> {
  try {
    const statInfo = await stat(path);

    return statInfo.isFile();
  } catch (err: unknown) {
    assertIsIOError(err);

    // allow ENOENT, which means it is not a file
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  return false;
}

/**
 * Returns `true` if the given path is a directory.
 *
 * Uses the `stat` syscall (follows symlinks) and ignores the `ENOENT` error (non-existent directory just returns `false`).
 */
export async function isDirectoryQuiet(path: string): Promise<boolean> {
  try {
    const statInfo = await stat(path);

    return statInfo.isDirectory();
  } catch (err: unknown) {
    assertIsIOError(err);

    // allow ENOENT, which means it is not a directory
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  return false;
}

export function streamWrite(stream: Writable, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeMore = stream.write(data, 'utf-8');

    if (!writeMore) {
      stream.once('error', reject);
      stream.once('drain', resolve);
    } else {
      resolve();
    }
  });
}

export function streamEnd(stream: Writable): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.once('close', resolve);
    stream.end();
  });
}

export function execFile(
  path: string,
  args?: string[],
  execOptions?: fs.ObjectEncodingOptions & childProcess.ExecFileOptions,
  options?: {
    forwardStdout?: boolean;
    forwardStderr?: boolean;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = childProcess.execFile(
      path,
      args,
      execOptions,
      (err, stdout, stderr) => {
        if (err) {
          reject({
            ...err,
            stdout,
            stderr,
          });
        } else {
          resolve();
        }
      }
    );

    if (options?.forwardStdout === true) {
      child.stdout?.on('data', chunk => process.stdout.write(chunk));
    }
    if (options?.forwardStderr === true) {
      child.stderr?.on('data', chunk => process.stderr.write(chunk));
    }
  });
}

export async function resolveSkipFile(
  flag: SkipFileType,
  files: string[]
): Promise<boolean> {
  if (flag === 'never') {
    return false;
  } else if (flag === 'always') {
    return true;
  } else {
    try {
      await Promise.all(files.map(file => access(file)));
    } catch (e) {
      // If at least one file cannot be accessed return false
      return false;
    }

    return true;
  }
}

/**
 * Returns `true` if directory or file
 * exists, is readable and is writable for the current user.
 */
export async function isAccessible(path: string): Promise<boolean> {
  try {
    await access(
      path,
      fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK
    );
  } catch (err: unknown) {
    assertIsIOError(err);

    if (err.code === 'ENOENT' || err.code === 'EACCES') {
      return false;
    }

    throw err;
  }

  return true;
}

/**
 * Returns file name with path and all extensions stripped
 */
export function basenameWithoutExt(path: string): string {
  // NOTE: Naive implementation, but should work for any case
  return basename(path).split('.')[0];
}
