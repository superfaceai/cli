import createDebug from 'debug';
import * as fs from 'fs';
import { dirname } from 'path';
import type { Writable } from 'stream';

import type { WritingOptions } from './io';
import { exists, streamEnd, streamWrite } from './io';

const outputStreamDebug = createDebug('superface:output-stream');
export class OutputStream {
  private readonly name: string;
  public readonly stream: Writable;
  public readonly isStdStream: boolean;
  public readonly isTTY: boolean;

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
  constructor(path: string, options?: WritingOptions) {
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
          `Opening/creating "${path}" in ${
            options?.append !== undefined ? 'append' : 'write'
          } mode`
        );
        if (options?.dirs === true) {
          const dir = dirname(path);
          fs.mkdirSync(dir, { recursive: true });
        }

        this.name = path;
        this.stream = fs.createWriteStream(path, {
          flags: options?.append !== undefined ? 'a' : 'w',
          mode: 0o644,
          encoding: 'utf-8',
        });
        this.isStdStream = false;
        this.isTTY = process.stdout.isTTY;
        break;
    }
  }

  public write(data: string): Promise<void> {
    outputStreamDebug(`Writing ${data.length} characters to "${this.name}"`);

    return streamWrite(this.stream, data);
  }

  public cleanup(): Promise<void> {
    outputStreamDebug(`Closing stream "${this.name}"`);

    // TODO: Should we also end stdout or stderr?
    if (!this.isStdStream) {
      return streamEnd(this.stream);
    }

    return Promise.resolve();
  }

  public static async writeOnce(
    path: string,
    data: string,
    options?: WritingOptions
  ): Promise<void> {
    const stream = new OutputStream(path, options);

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
  public static async writeIfAbsent(
    path: string,
    data: string | (() => string),
    options?: WritingOptions
  ): Promise<boolean> {
    if (options?.force === true || !(await exists(path))) {
      const dat = typeof data === 'string' ? data : data();

      await OutputStream.writeOnce(path, dat, options);

      return true;
    }

    return false;
  }
}
