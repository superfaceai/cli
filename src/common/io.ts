import * as fs from 'fs';
import { Writable } from 'stream';
import { promisify } from 'util';

export const readFilePromise = promisify(fs.readFile);
export function streamWritePromise(stream: Writable, data: string): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      const writeMore = stream.write(data, 'utf-8');
      
      if (!writeMore) {
        stream.once('error', reject);
        stream.once('drain', resolve);
      } else {
        resolve();
      }
    }
  )
}
export function streamEndPromise(stream: Writable): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      stream.once('error', reject);
      stream.once('close', resolve);
    }
  )
}

export class OutputStream {
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
        this.stream = process.stdout;
        this.isStdStream = true;
        this.isTTY = process.stdout.isTTY;
        break;

      case '-2':
        this.stream = process.stderr;
        this.isStdStream = true;
        this.isTTY = process.stdout.isTTY;
        break;

      default:
        this.stream = fs.createWriteStream(path, {
          flags: append ? 'a' : 'w',
          mode: 0o644,
          encoding: 'utf-8'
        });
        this.isStdStream = true;
        this.isTTY = process.stdout.isTTY;
        break;
    }
  }

  write(data: string): Promise<void> {
    return streamWritePromise(this.stream, data);
  }

  cleanup(): Promise<void> {
    // TODO: Should we also end stdout or stderr?
    if (!this.isStdStream) {
      return streamEndPromise(this.stream);
    }

    return Promise.resolve();
  }
}