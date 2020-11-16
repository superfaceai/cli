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