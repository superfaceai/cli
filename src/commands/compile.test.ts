import { CLIError } from '@oclif/errors';
import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import { isDirectoryQuiet, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';
import Compile from './compile';

//Mock io
jest.mock('../common/io', () => ({
  readFile: jest.fn(),
  isDirectoryQuiet: jest.fn(),
}));

//Mock output stream
jest.mock('../common/output-stream');

jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual<Record<string, unknown>>('@superfaceai/parser'),
  parseMap: jest.fn(),
  parseProfile: jest.fn(),
}));

describe('Compile CLI command', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running compile command', () => {
    const mockContent = 'mock-file-content';

    const mockMapPath = 'test.suma';

    const mockMapDocument: MapDocumentNode = {
      kind: 'MapDocument',
      header: {
        kind: 'MapHeader',
        profile: {
          name: 'different-test-profile',
          scope: 'some-map-scope',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        provider: 'test-profile',
      },
      definitions: [],
    };
    const mockProfilePath = 'test.supr';

    const mockProfileDocument: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      header: {
        kind: 'ProfileHeader',
        name: 'test-profile',
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      },
      definitions: [],
    };

    it('compiles map', async () => {
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseMap).mockReturnValue(mockMapDocument);
      mocked(isDirectoryQuiet).mockResolvedValue(false);
      //Prototype => mock write method on every instance
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(
        Compile.run([mockMapPath, '-o', '-'])
      ).resolves.toBeUndefined();

      expect(isDirectoryQuiet).toHaveBeenCalledTimes(1);
      expect(isDirectoryQuiet).toHaveBeenCalledWith('-');

      expect(parseMap).toHaveBeenCalledTimes(1);
      expect(parseMap).toHaveBeenCalledWith(
        new Source(mockContent, mockMapPath)
      );

      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(
        JSON.stringify(mockMapDocument, undefined, 2)
      );

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('compiles profile', async () => {
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseProfile).mockReturnValue(mockProfileDocument);
      mocked(isDirectoryQuiet).mockResolvedValue(false);
      //Prototype => mock write method on every instance
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(
        Compile.run([mockProfilePath, '-o', '-'])
      ).resolves.toBeUndefined();

      expect(isDirectoryQuiet).toHaveBeenCalledTimes(1);
      expect(isDirectoryQuiet).toHaveBeenCalledWith('-');

      expect(parseProfile).toHaveBeenCalledTimes(1);
      expect(parseProfile).toHaveBeenCalledWith(
        new Source(mockContent, mockProfilePath)
      );

      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(
        JSON.stringify(mockProfileDocument, undefined, 2)
      );

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('compiles two files into one stream', async () => {
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseProfile).mockReturnValue(mockProfileDocument);
      mocked(parseMap).mockReturnValue(mockMapDocument);
      mocked(isDirectoryQuiet).mockResolvedValue(false);
      //Prototype => mock write method on every instance
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(
        Compile.run([mockProfilePath, mockMapPath, '-o', '-'])
      ).resolves.toBeUndefined();

      expect(isDirectoryQuiet).toHaveBeenCalledTimes(1);
      expect(isDirectoryQuiet).toHaveBeenCalledWith('-');

      expect(parseProfile).toHaveBeenCalledTimes(1);
      expect(parseProfile).toHaveBeenCalledWith(
        new Source(mockContent, mockProfilePath)
      );

      expect(parseMap).toHaveBeenCalledTimes(1);
      expect(parseMap).toHaveBeenCalledWith(
        new Source(mockContent, mockMapPath)
      );

      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy).toHaveBeenNthCalledWith(
        1,
        JSON.stringify(mockProfileDocument, undefined, 2)
      );
      expect(writeSpy).toHaveBeenNthCalledWith(
        2,
        JSON.stringify(mockMapDocument, undefined, 2)
      );

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('compiles to outdir', async () => {
      const mockdir = 'testDir';

      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseProfile).mockReturnValue(mockProfileDocument);
      mocked(parseMap).mockReturnValue(mockMapDocument);
      mocked(isDirectoryQuiet).mockResolvedValue(true);
      //Prototype => mock write method on every instance
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(
        Compile.run([mockProfilePath, mockMapPath, '-o', mockdir])
      ).resolves.toBeUndefined();

      expect(isDirectoryQuiet).toHaveBeenCalledTimes(1);
      expect(isDirectoryQuiet).toHaveBeenCalledWith(mockdir);

      expect(parseProfile).toHaveBeenCalledTimes(1);
      expect(parseProfile).toHaveBeenCalledWith(
        new Source(mockContent, mockProfilePath)
      );

      expect(parseMap).toHaveBeenCalledTimes(1);
      expect(parseMap).toHaveBeenCalledWith(
        new Source(mockContent, mockMapPath)
      );

      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy).toHaveBeenNthCalledWith(
        1,
        JSON.stringify(mockProfileDocument, undefined, 2)
      );
      expect(writeSpy).toHaveBeenNthCalledWith(
        2,
        JSON.stringify(mockMapDocument, undefined, 2)
      );
      expect(cleanupSpy).toHaveBeenCalledTimes(2);
    });

    it('compiles without outdir', async () => {
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseProfile).mockReturnValue(mockProfileDocument);
      mocked(parseMap).mockReturnValue(mockMapDocument);
      mocked(isDirectoryQuiet).mockResolvedValue(true);
      //Prototype => mock write method on every instance
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(
        Compile.run([mockProfilePath, mockMapPath])
      ).resolves.toBeUndefined();

      expect(isDirectoryQuiet).toHaveBeenCalledTimes(0);

      expect(parseProfile).toHaveBeenCalledTimes(1);
      expect(parseProfile).toHaveBeenCalledWith(
        new Source(mockContent, mockProfilePath)
      );

      expect(parseMap).toHaveBeenCalledTimes(1);
      expect(parseMap).toHaveBeenCalledWith(
        new Source(mockContent, mockMapPath)
      );

      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy).toHaveBeenNthCalledWith(
        1,
        JSON.stringify(mockProfileDocument, undefined, 2)
      );
      expect(writeSpy).toHaveBeenNthCalledWith(
        2,
        JSON.stringify(mockMapDocument, undefined, 2)
      );
      expect(cleanupSpy).toHaveBeenCalledTimes(2);
    });

    it('throws error on unknown document type', async () => {
      const mockPath = 'test';
      mocked(readFile).mockResolvedValue(mockContent);
      mocked(parseMap).mockReturnValue(mockMapDocument);
      mocked(isDirectoryQuiet).mockResolvedValue(false);
      //Prototype => mock write method on every instance
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(Compile.run([mockPath, '-o', '-'])).rejects.toEqual(
        new CLIError('Could not infer document type')
      );

      expect(isDirectoryQuiet).toHaveBeenCalledTimes(1);
      expect(isDirectoryQuiet).toHaveBeenCalledWith('-');

      expect(parseMap).toHaveBeenCalledTimes(0);

      expect(writeSpy).toHaveBeenCalledTimes(0);

      expect(cleanupSpy).toHaveBeenCalledTimes(0);
    });
  });
});
