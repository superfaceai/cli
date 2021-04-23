import { SuperJson } from '@superfaceai/one-sdk';
import { join } from 'path';
import { Writable } from 'stream';

import {
  execFile,
  exists,
  isAccessible,
  isDirectoryQuiet,
  isFileQuiet,
  mkdirQuiet,
  resolveSkipFile,
  rimraf,
  streamEnd,
  streamWrite,
} from '../common/io';
import { OutputStream } from '../common/output-stream';
import { SUPER_PATH } from './document';

describe('IO functions', () => {
  const WORKING_DIR = join('fixtures', 'io');

  const FIXTURE = {
    superJson: SUPER_PATH,
  };

  let INITIAL_CWD: string;
  let INITIAL_SUPER_JSON: SuperJson;

  //Mock writable stream for testing backpressure
  class MockWritable extends Writable {
    constructor(private writeMore: boolean) {
      super();
    }

    write(_chunk: any): boolean {
      return this.writeMore;
    }
  }

  beforeAll(async () => {
    INITIAL_CWD = process.cwd();
    process.chdir(WORKING_DIR);

    INITIAL_SUPER_JSON = (await SuperJson.load(FIXTURE.superJson)).unwrap();
  });

  afterAll(async () => {
    await resetSuperJson();

    // change cwd back
    process.chdir(INITIAL_CWD);
  });

  /** Resets super.json to initial state stored in `INITIAL_SUPER_JSON` */
  async function resetSuperJson() {
    await OutputStream.writeOnce(
      FIXTURE.superJson,
      JSON.stringify(INITIAL_SUPER_JSON.document, undefined, 2)
    );
  }

  beforeEach(async () => {
    await resetSuperJson();
  });

  afterEach(async () => {
    await rimraf('test');
  });

  describe('when checking if file exists', () => {
    it('checks file existence correctly', async () => {
      await expect(exists(FIXTURE.superJson)).resolves.toEqual(true);
      await expect(exists('superface')).resolves.toEqual(true);
      await expect(exists('some/made/up/file.json')).resolves.toEqual(false);
    }, 10000);
  });

  describe('when creating folder', () => {
    it('creates new folder', async () => {
      await expect(mkdirQuiet('test')).resolves.toEqual(true);
    }, 10000);

    it('does not create already existing folder', async () => {
      await expect(mkdirQuiet('superface')).resolves.toEqual(false);
    }, 10000);
  });

  describe('when checking if the given path is a file', () => {
    it('checks if path is a file correctly', async () => {
      await expect(isFileQuiet(FIXTURE.superJson)).resolves.toEqual(true);
      await expect(isFileQuiet('superface')).resolves.toEqual(false);
      await expect(isFileQuiet('some/made/up/file.json')).resolves.toEqual(
        false
      );
    }, 10000);
  });

  describe('when checking if the given path is a directory', () => {
    it('checks if path is a directory correctly', async () => {
      await expect(isDirectoryQuiet('superface')).resolves.toEqual(true);
      await expect(isDirectoryQuiet(FIXTURE.superJson)).resolves.toEqual(false);
      await expect(isDirectoryQuiet('some/made/up/file.json')).resolves.toEqual(
        false
      );
    }, 10000);
  });

  describe('when writing to stream', () => {
    it('rejects if a stream error occurs', async () => {
      const mockWriteable = new MockWritable(false);
      const actualPromise = streamWrite(mockWriteable, 'test/mockFile.json');
      setTimeout(() => {
        mockWriteable.emit('error');
        mockWriteable.emit('end');
      }, 100);
      await expect(actualPromise).rejects.toBeUndefined();
    }, 10000);

    it('resolves if drain occurs', async () => {
      const mockWriteable = new MockWritable(false);
      const actualPromise = streamWrite(mockWriteable, 'test/mockFile.json');
      setTimeout(() => {
        mockWriteable.emit('drain');
        mockWriteable.emit('end');
      }, 100);
      await expect(actualPromise).resolves.toBeUndefined();
    }, 10000);

    it('resolves if stream is not backpressured', async () => {
      const mockWriteable = new MockWritable(true);
      const actualPromise = streamWrite(mockWriteable, 'test/mockFile.json');
      setTimeout(() => {
        mockWriteable.emit('end');
      }, 100);
      await expect(actualPromise).resolves.toBeUndefined();
    }, 10000);
  });

  describe('when calling stream end', () => {
    it('resolves if close occurs', async () => {
      const mockWriteable = new MockWritable(false);
      const actualPromise = streamEnd(mockWriteable);
      setTimeout(() => {
        mockWriteable.emit('close');
        mockWriteable.emit('end');
      }, 100);
      await expect(actualPromise).resolves.toBeUndefined();
    }, 10000);
  });

  describe('when calling exec file', () => {
    it('rejects if command does not exist', async () => {
      const actualPromise = execFile('not-existing');
      await expect(actualPromise).rejects.not.toBeUndefined();
    }, 10000);

    it('resolves command is executed', async () => {
      const actualPromise = execFile('node', ['--version']);
      await expect(actualPromise).resolves.toBeUndefined();
    }, 10000);
  });

  describe('when resolving skip file', () => {
    it('resolve skip file correctly', async () => {
      await expect(resolveSkipFile('never', [])).resolves.toEqual(false);
      await expect(resolveSkipFile('always', [])).resolves.toEqual(true);
      await expect(
        resolveSkipFile('exists', [FIXTURE.superJson])
      ).resolves.toEqual(true);
      await expect(
        resolveSkipFile('exists', [FIXTURE.superJson, 'some/made/up/file.json'])
      ).resolves.toEqual(false);
    }, 10000);
  });

  describe('when checking if the given path is accessible', () => {
    it('checks if path is accessible correctly', async () => {
      await expect(isAccessible('superface')).resolves.toEqual(true);
      await expect(isAccessible(FIXTURE.superJson)).resolves.toEqual(true);
      await expect(isAccessible('some/made/up/file.json')).resolves.toEqual(
        false
      );
    }, 10000);
  });
});
