import * as childProcess from 'child_process';
import createDebug from 'debug';
import * as fs from 'fs';
import { dirname } from 'path';
import rimrafCallback from 'rimraf';
import { Writable } from 'stream';
import { promisify } from 'util';

import { WritingOptions } from './document.interfaces';
import { assertIsIOError } from './error';
import { SkipFileType } from './flags';

export const readFile = promisify(fs.readFile);
export const access = promisify(fs.access);
export const stat = promisify(fs.stat);
export const readdir = promisify(fs.readdir);
export const mkdir = promisify(fs.mkdir);
export const realpath = promisify(fs.realpath);

export const rimraf = promisify(rimrafCallback);

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

    // allow ENOENT, which means it is not a directory
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
  });
}

export function execFile(
  path: string,
  args?: string[],
  execOptions?: fs.BaseEncodingOptions & childProcess.ExecFileOptions,
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

const outputStreamDebug = createDebug('superface:OutputStream');
export class OutputStream {
  private readonly name: string;
  readonly stream: Writable;

  readonly isStdStream: boolean;
  readonly isTTY: boolean;

  /**
   * Constructs the output object.
   *
   * `path` accepts 2 special values:
   * * `-` - initializes output for stdout
   * * `-2` - initializes output for stderr
   *
   * All other `path` values are treated as file system path.
   *
   * When `append` is true the file at `path` is opened in append mode rather than in write (truncate) mode.
   */
  constructor(path: string, append?: boolean) {
    switch (path) {
      case '-':
        outputStreamDebug('Opening stdout');
        this.name = 'stdout';
        this.stream = process.stdout;
        this.isStdStream = true;
        this.isTTY = process.stdout.isTTY;
        break;

      case '-2':
        outputStreamDebug('Opening stderr');
        this.name = 'stderr';
        this.stream = process.stderr;
        this.isStdStream = true;
        this.isTTY = process.stdout.isTTY;
        break;

      default:
        outputStreamDebug(
          `Opening/creating "${path}" in ${append ? 'append' : 'write'} mode`
        );
        this.name = path;
        this.stream = fs.createWriteStream(path, {
          flags: append ? 'a' : 'w',
          mode: 0o644,
          encoding: 'utf-8',
        });
        this.isStdStream = true;
        this.isTTY = process.stdout.isTTY;
        break;
    }
  }

  write(data: string): Promise<void> {
    outputStreamDebug(`Writing ${data.length} characters to "${this.name}"`);

    return streamWrite(this.stream, data);
  }

  cleanup(): Promise<void> {
    outputStreamDebug(`Closing stream "${this.name}"`);

    // TODO: Should we also end stdout or stderr?
    if (!this.isStdStream) {
      return streamEnd(this.stream);
    }

    return Promise.resolve();
  }

  static async writeOnce(
    path: string,
    data: string,
    append?: boolean
  ): Promise<void> {
    const stream = new OutputStream(path, append);

    await stream.write(data);

    return stream.cleanup();
  }

  /**
   * Creates file with given contents if it doesn't exist.
   *
   * Returns whether the file was created.
   *
   * For convenience the `force` option can be provided
   * to force the creation.
   *
   * The `dirs` option additionally recursively creates
   * directories up until the file path.
   */
  static async writeIfAbsent(
    path: string,
    data: string | (() => string),
    options?: WritingOptions
  ): Promise<boolean> {
    if (options?.dirs === true) {
      const dir = dirname(path);
      await mkdir(dir, { recursive: true });
    }

    if (options?.force === true || !(await exists(path))) {
      const dat = typeof data === 'string' ? data : data();

      await OutputStream.writeOnce(path, dat, options?.append);

      return true;
    }

    return false;
  }
}
