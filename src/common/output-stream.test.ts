import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { rimraf, streamEnd, streamWrite } from '../common/io';
import { OutputStream } from '../common/output-stream';

// Mock only streamWrite and streamEnd response
jest.mock('../common/io', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/io'),
  streamWrite: jest.fn(),
  streamEnd: jest.fn(),
}));

jest.mock('../index');

describe('OutputStream', () => {
  const WORKING_DIR = join('fixtures', 'io');

  let INITIAL_CWD: string;

  beforeAll(async () => {
    INITIAL_CWD = process.cwd();
    process.chdir(WORKING_DIR);
  });

  afterAll(async () => {
    // change cwd back
    process.chdir(INITIAL_CWD);
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await rimraf('test');
  });

  describe('when writing to stream', () => {
    it('calls write to file correctly', async () => {
      const outputStream = new OutputStream('test/test.txt', { dirs: true });
      await outputStream.write('testData');
      expect(streamWrite).toHaveBeenCalledTimes(1);
      expect(streamWrite).toHaveBeenCalledWith(outputStream.stream, 'testData');
    }, 10000);

    it('calls write to stdout correctly', async () => {
      const outputStream = new OutputStream('-');
      await outputStream.write('testData');
      expect(streamWrite).toHaveBeenCalledTimes(1);
      expect(streamWrite).toHaveBeenCalledWith(outputStream.stream, 'testData');
    }, 10000);

    it('calls write to stderr correctly', async () => {
      const outputStream = new OutputStream('-2');
      await outputStream.write('testData');
      expect(streamWrite).toHaveBeenCalledTimes(1);
      expect(streamWrite).toHaveBeenCalledWith(outputStream.stream, 'testData');
    }, 10000);
  });

  describe('when calling cleanup', () => {
    it('calls streamEnd correctly', async () => {
      const outputStream = new OutputStream('test/test.json', { dirs: true });
      await outputStream.cleanup();
      expect(streamEnd).toHaveBeenCalledTimes(1);
      expect(streamEnd).toHaveBeenCalledWith(outputStream.stream);
    }, 10000);

    it('does not call streamEnd', async () => {
      const outputStream = new OutputStream('-');
      await outputStream.cleanup();
      expect(streamEnd).not.toHaveBeenCalled();
    }, 10000);
  });

  describe('when writing once', () => {
    it('calls streamEnd correctly', async () => {
      await OutputStream.writeOnce('test/test.json', 'testData', {
        dirs: true,
      });
      expect(streamWrite).toHaveBeenCalledTimes(1);
      expect(streamWrite).toHaveBeenCalledWith(expect.anything(), 'testData');
      expect(streamEnd).toHaveBeenCalledTimes(1);
    }, 10000);

    it('does not call streamEnd', async () => {
      const outputStream = new OutputStream('-');
      await outputStream.cleanup();
      expect(streamEnd).not.toHaveBeenCalled();
    }, 10000);
  });

  describe('when calling writeIfAbsent', () => {
    it('returns false if file exists and there is no force flag', async () => {
      await mkdir('test', { recursive: true });
      await writeFile(join('test', 'test.txt'), 'testData');

      expect(
        await OutputStream.writeIfAbsent(join('test', 'test.txt'), 'testData', {
          dirs: true,
        })
      ).toEqual(false);
    }, 10000);

    it('returns true if file does not exist', async () => {
      expect(
        await OutputStream.writeIfAbsent('test/test.json', 'testData', {
          dirs: true,
        })
      ).toEqual(true);
      expect(streamWrite).toHaveBeenCalledTimes(1);
      expect(streamWrite).toHaveBeenCalledWith(expect.anything(), 'testData');
    }, 10000);

    it('returns true if there is force flag', async () => {
      // create file
      expect(
        await OutputStream.writeIfAbsent('test/test.json', 'testData1', {
          dirs: true,
        })
      ).toEqual(true);
      expect(streamWrite).toHaveBeenCalledTimes(1);
      expect(streamWrite).toHaveBeenCalledWith(expect.anything(), 'testData1');
      expect(
        await OutputStream.writeIfAbsent('test/test.json', 'testData2', {
          dirs: true,
          force: true,
        })
      ).toEqual(true);
      expect(streamWrite).toHaveBeenCalledTimes(2);
      expect(streamWrite).toHaveBeenCalledWith(expect.anything(), 'testData2');
    }, 10000);
  });
});
