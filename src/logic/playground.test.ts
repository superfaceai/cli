import { CLIError } from '@oclif/errors';
import { ok, SuperJson } from '@superfaceai/sdk';
import * as fs from 'fs';
import { mocked } from 'ts-jest/utils';

import Compile from '../commands/compile';
import { DEFAULT_PROFILE_VERSION } from '../common/document';
import {
  execFile,
  isDirectoryQuiet,
  isFileQuiet,
  mkdir,
  readdir,
  realpath,
  resolveSkipFile,
  rimraf,
} from '../common/io';
import { OutputStream } from '../common/output-stream';
import * as playgroundTemplate from '../templates/playground';
import { createMap, createProfile, createProviderJson } from './create';
import { initSuperface } from './init';
import {
  cleanPlayground,
  detectPlayground,
  executePlayground,
  initializePlayground,
  PlaygroundInstance,
} from './playground';

//Mock create
jest.mock('./create', () => ({
  createMap: jest.fn(),
  createProfile: jest.fn(),
  createProviderJson: jest.fn(),
}));

//Mock init
jest.mock('./init', () => ({
  initSuperface: jest.fn(),
}));

//Mock io
jest.mock('../common/io', () => ({
  realpath: jest.fn(),
  isDirectoryQuiet: jest.fn(),
  isFileQuiet: jest.fn(),
  readdir: jest.fn(),
  rimraf: jest.fn(),
  mkdir: jest.fn(),
  mkdirQuiet: jest.fn(),
  resolveSkipFile: jest.fn(),
  execFile: jest.fn(),
}));
describe('playground logic', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  describe('when detecting playground', () => {
    it('builds paths correctly', async () => {
      const basepath = process.cwd();
      const mockPlaygroundInstances: PlaygroundInstance[] = [
        {
          path: 'users/real/path/to/test-playground',
          name: 'first',
          profilePath: basepath + '/first/profile/file',
          providers: [
            {
              mapPath: basepath + '/first/profile/first/provider/file',
              name: 'first-provider',
            },
          ],
          scope: undefined,
        },
        {
          path: 'users/real/path/to/test-playground',
          name: 'second',
          profilePath: basepath + '/second/profile/file',
          providers: [
            {
              mapPath: basepath + '/second/profile/first/provider/file',
              name: 'first-provider',
            },
          ],
          scope: 'directory',
        },
      ];
      const mockPath = 'test-playground';
      jest.spyOn(SuperJson, 'load').mockResolvedValue(
        ok(
          new SuperJson({
            profiles: {
              first: {
                file: 'first/profile/file',
                version: '1.0.0',
                providers: {
                  ['first-provider']: {
                    file: 'first/profile/first/provider/file',

                    defaults: {},
                  },
                },
              },
              ['directory/second']: {
                file: 'second/profile/file',
                version: '2.0.0',
                providers: {
                  ['first-provider']: {
                    file: 'second/profile/first/provider/file',
                    defaults: {},
                  },
                },
              },
            },
          })
        )
      );
      mocked(realpath).mockResolvedValue('users/real/path/to/test-playground');
      mocked(isDirectoryQuiet).mockResolvedValue(true);
      mocked(isFileQuiet).mockResolvedValue(true);

      const mockFileWithDirectory: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'first.play.ts',
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => true,
          isFIFO: () => false,
          isFile: () => false,
          isSocket: () => false,
          name: 'directory',
        },
      ];
      //nested in directory
      const mockFile: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'second.play.ts',
        },
      ];
      mocked(readdir)
        .mockResolvedValueOnce(mockFileWithDirectory)
        .mockResolvedValue(mockFile);

      await expect(detectPlayground(mockPath)).resolves.toEqual(
        mockPlaygroundInstances
      );
    });

    it('throws error when path does not exist', async () => {
      const mockPath = 'test-playground';
      jest.spyOn(SuperJson, 'load').mockResolvedValue(ok(new SuperJson({})));
      mocked(realpath).mockRejectedValue(new Error('EACCESS'));
      mocked(isDirectoryQuiet).mockResolvedValue(true);
      mocked(isFileQuiet).mockResolvedValue(true);

      const mockFileWithDirectory: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'first.play.ts',
        },
      ];
      mocked(readdir).mockResolvedValueOnce(mockFileWithDirectory);

      await expect(detectPlayground(mockPath)).rejects.toEqual(
        new CLIError('The playground path must exist and be accessible')
      );
    });

    it('throws error when path is not a directory', async () => {
      const mockPath = 'test-playground';
      jest.spyOn(SuperJson, 'load').mockResolvedValue(ok(new SuperJson({})));
      mocked(realpath).mockResolvedValue('users/real/path/to/test-playground');
      mocked(isDirectoryQuiet).mockResolvedValue(false);
      mocked(isFileQuiet).mockResolvedValue(true);

      const mockFileWithDirectory: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'first.play.ts',
        },
      ];
      mocked(readdir).mockResolvedValueOnce(mockFileWithDirectory);

      await expect(detectPlayground(mockPath)).rejects.toEqual(
        new CLIError('The playground path must be a directory')
      );
    });

    it('throws error when package.json is not a file', async () => {
      const mockPath = 'test-playground';
      jest.spyOn(SuperJson, 'load').mockResolvedValue(ok(new SuperJson({})));
      mocked(realpath).mockResolvedValue('users/real/path/to/test-playground');
      mocked(isDirectoryQuiet).mockResolvedValue(true);
      mocked(isFileQuiet).mockResolvedValue(false);

      const mockFileWithDirectory: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'first.play.ts',
        },
      ];
      mocked(readdir).mockResolvedValueOnce(mockFileWithDirectory);

      await expect(detectPlayground(mockPath)).rejects.toEqual(
        new CLIError(
          'The directory at playground path is not a playground: no "users/real/path/to/test-playground/superface/package.json" found'
        )
      );
    });

    it('throws error when super.json is not a file', async () => {
      const mockPath = 'test-playground';
      jest.spyOn(SuperJson, 'load').mockResolvedValue(ok(new SuperJson({})));
      mocked(realpath).mockResolvedValue('users/real/path/to/test-playground');
      mocked(isDirectoryQuiet).mockResolvedValue(true);
      mocked(isFileQuiet)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const mockFileWithDirectory: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'first.play.ts',
        },
      ];
      mocked(readdir).mockResolvedValueOnce(mockFileWithDirectory);

      await expect(detectPlayground(mockPath)).rejects.toEqual(
        new CLIError(
          'The directory at playground path is not a playground: no "users/real/path/to/test-playground/superface/super.json" found'
        )
      );
    });

    it('throws error when there are no play scripts', async () => {
      const mockPath = 'test-playground';
      jest.spyOn(SuperJson, 'load').mockResolvedValue(ok(new SuperJson({})));
      mocked(realpath).mockResolvedValue('users/real/path/to/test-playground');
      mocked(isDirectoryQuiet).mockResolvedValue(true);
      mocked(isFileQuiet).mockResolvedValue(true);

      const mockFileWithDirectory: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'first.some.ts',
        },
      ];
      mocked(readdir).mockResolvedValueOnce(mockFileWithDirectory);

      await expect(detectPlayground(mockPath)).rejects.toEqual(
        new CLIError(
          'The directory at playground path is not a playground: no play scripts found'
        )
      );
    });

    it('throws error when there are no local profile-provider pairs', async () => {
      const mockPath = 'test-playground';
      jest.spyOn(SuperJson, 'load').mockResolvedValue(ok(new SuperJson({})));
      mocked(realpath).mockResolvedValue('users/real/path/to/test-playground');
      mocked(isDirectoryQuiet).mockResolvedValue(true);
      mocked(isFileQuiet).mockResolvedValue(true);

      const mockFileWithDirectory: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: 'first.play.ts',
        },
      ];
      mocked(readdir).mockResolvedValueOnce(mockFileWithDirectory);

      await expect(detectPlayground(mockPath)).rejects.toEqual(
        new CLIError(
          'The directory at playground path is not a playground: no local profile-provider pairs found in super.json'
        )
      );
    });
  });
  describe('when initializing playground', () => {
    const mockPath = 'test';
    it('creates files correctly', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(createProfile).mockResolvedValue(undefined);
      mocked(createMap).mockResolvedValue(undefined);
      mocked(createProviderJson).mockResolvedValue(undefined);

      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      await expect(
        initializePlayground(
          mockPath,
          {
            scope: 'test-scope',
            name: 'test-name',
            providers: ['twilio', 'tyntac'],
          },
          'empty'
        )
      ).resolves.toBeUndefined();

      expect(initSuperface).toHaveBeenCalledTimes(1);
      expect(initSuperface).toHaveBeenCalledWith(mockPath, {}, undefined);

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(2);
      expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
        1,
        'test/superface/package.json',
        playgroundTemplate.packageJson,
        { force: undefined }
      );
      expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
        2,
        'test/superface/play/test-scope/test-name.play.ts',
        expect.anything(),
        { force: undefined, dirs: true }
      );

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith('', '{}');

      expect(createProfile).toHaveBeenCalledTimes(1);
      expect(createProfile).toHaveBeenCalledWith(
        mockPath,
        new SuperJson({}),
        {
          scope: 'test-scope',
          name: 'test-name',
          version: DEFAULT_PROFILE_VERSION,
        },
        ['TestName'],
        'empty',
        undefined
      );

      expect(createMap).toHaveBeenCalledTimes(2);
      expect(createMap).toHaveBeenNthCalledWith(
        1,
        mockPath,
        new SuperJson({}),
        {
          scope: 'test-scope',
          name: 'test-name',
          provider: 'twilio',
          version: DEFAULT_PROFILE_VERSION,
        },
        ['TestName'],
        'empty',
        undefined
      );
      expect(createMap).toHaveBeenNthCalledWith(
        2,
        mockPath,
        new SuperJson({}),
        {
          scope: 'test-scope',
          name: 'test-name',
          provider: 'tyntac',
          version: DEFAULT_PROFILE_VERSION,
        },
        ['TestName'],
        'empty',
        undefined
      );

      expect(createProviderJson).toHaveBeenCalledTimes(2);
      expect(createProviderJson).toHaveBeenNthCalledWith(
        1,
        mockPath,
        new SuperJson({}),
        'twilio',
        'empty',
        undefined
      );
      expect(createProviderJson).toHaveBeenNthCalledWith(
        2,
        mockPath,
        new SuperJson({}),
        'tyntac',
        'empty',
        undefined
      );
    });
  });

  describe('when executing playground', () => {
    const basepath = process.cwd();
    let mockPlaygroundInstance: PlaygroundInstance;
    beforeEach(() => {
      mockPlaygroundInstance = {
        path: 'users/real/path/to/test-playground',
        name: 'first',
        profilePath: basepath + '/first/profile/file',
        providers: [
          {
            mapPath: basepath + '/first/profile/first/provider/file',
            name: 'first-provider',
          },
          {
            mapPath: basepath + '/first/profile/second/provider/file',
            name: 'second-provider',
          },
        ],
        scope: undefined,
      };
    });

    it('executes playground correctly - skiping files', async () => {
      mocked(mkdir).mockResolvedValue(undefined);

      mocked(resolveSkipFile).mockResolvedValue(true);
      mocked(execFile).mockResolvedValue(undefined);

      //skip overiden by mocks
      await expect(
        executePlayground(
          mockPlaygroundInstance,
          ['first-provider'],
          { npm: 'always', ast: 'always', tsc: 'always' },
          { debugLevel: 'info' }
        )
      ).resolves.toBeUndefined();

      expect(mkdir).toHaveBeenCalledTimes(1);
      expect(
        mkdir
      ).toHaveBeenCalledWith(
        'users/real/path/to/test-playground/superface/build',
        { recursive: true, mode: 0o744 }
      );

      expect(resolveSkipFile).toHaveBeenCalledTimes(3);

      expect(execFile).toHaveBeenCalledTimes(1);
      expect(execFile).toHaveBeenCalledWith(
        '/usr/local/bin/node',
        [
          'users/real/path/to/test-playground/superface/build/first.play.js',
          'first.first-provider',
        ],
        {
          cwd: 'users/real/path/to/test-playground',
          env: {
            ...process.env,
            DEBUG_COLORS: '',
            DEBUG: 'info',
          },
        },
        {
          forwardStdout: true,
          forwardStderr: true,
        }
      );
    });

    it('executes playground correctly - executing npm install', async () => {
      mockPlaygroundInstance.scope = 'scope';
      mocked(mkdir).mockResolvedValue(undefined);

      mocked(resolveSkipFile)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      mocked(execFile).mockResolvedValue(undefined);

      //skip overiden by mocks
      await expect(
        executePlayground(
          mockPlaygroundInstance,
          ['first-provider'],
          { npm: 'always', ast: 'always', tsc: 'always' },
          { debugLevel: 'info' }
        )
      ).resolves.toBeUndefined();

      expect(mkdir).toHaveBeenCalledTimes(1);
      expect(
        mkdir
      ).toHaveBeenCalledWith(
        'users/real/path/to/test-playground/superface/build/scope',
        { recursive: true, mode: 0o744 }
      );

      expect(resolveSkipFile).toHaveBeenCalledTimes(3);

      expect(execFile).toHaveBeenCalledTimes(2);
      expect(execFile).toHaveBeenNthCalledWith(1, 'npm', ['install'], {
        cwd: 'users/real/path/to/test-playground/superface',
      });
      expect(execFile).toHaveBeenNthCalledWith(
        2,
        '/usr/local/bin/node',
        [
          'users/real/path/to/test-playground/superface/build/scope/first.play.js',
          'scope/first.first-provider',
        ],
        {
          cwd: 'users/real/path/to/test-playground',
          env: {
            ...process.env,
            DEBUG_COLORS: '',
            DEBUG: 'info',
          },
        },
        {
          forwardStdout: true,
          forwardStderr: true,
        }
      );
    });

    it('throws error when there is an error executing npm install', async () => {
      mockPlaygroundInstance.scope = 'scope';
      mocked(mkdir).mockResolvedValue(undefined);

      mocked(resolveSkipFile)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      mocked(execFile).mockRejectedValue({ stdout: 'mock', stderr: 'mock' });

      //skip overiden by mocks
      await expect(
        executePlayground(
          mockPlaygroundInstance,
          ['first-provider'],
          { npm: 'always', ast: 'always', tsc: 'always' },
          { debugLevel: 'info' }
        )
      ).rejects.toEqual(new CLIError(`npm install failed:\nmock`));

      expect(mkdir).toHaveBeenCalledTimes(1);
      expect(
        mkdir
      ).toHaveBeenCalledWith(
        'users/real/path/to/test-playground/superface/build/scope',
        { recursive: true, mode: 0o744 }
      );

      expect(resolveSkipFile).toHaveBeenCalledTimes(1);
    });

    it('executes playground correctly - executing superface compile', async () => {
      mocked(mkdir).mockResolvedValue(undefined);

      mocked(resolveSkipFile)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      mocked(execFile).mockResolvedValue(undefined);
      const compileSpy = jest.spyOn(Compile, 'run').mockResolvedValue(true);

      //skip overiden by mocks
      await expect(
        executePlayground(
          mockPlaygroundInstance,
          ['first-provider'],
          { npm: 'always', ast: 'always', tsc: 'always' },
          { debugLevel: 'info' }
        )
      ).resolves.toBeUndefined();

      expect(mkdir).toHaveBeenCalledTimes(1);
      expect(
        mkdir
      ).toHaveBeenCalledWith(
        'users/real/path/to/test-playground/superface/build',
        { recursive: true, mode: 0o744 }
      );

      expect(resolveSkipFile).toHaveBeenCalledTimes(3);

      expect(compileSpy).toHaveBeenCalledTimes(1);
      expect(compileSpy).toHaveBeenCalledWith([
        basepath + '/first/profile/file',
        basepath + '/first/profile/first/provider/file',
      ]);

      expect(execFile).toHaveBeenCalledTimes(1);
      expect(execFile).toHaveBeenCalledWith(
        '/usr/local/bin/node',
        [
          'users/real/path/to/test-playground/superface/build/first.play.js',
          'first.first-provider',
        ],
        {
          cwd: 'users/real/path/to/test-playground',
          env: {
            ...process.env,
            DEBUG_COLORS: '',
            DEBUG: 'info',
          },
        },
        {
          forwardStdout: true,
          forwardStderr: true,
        }
      );
    });

    it('throws error when there is an error executing superface compile', async () => {
      mocked(mkdir).mockResolvedValue(undefined);

      mocked(resolveSkipFile)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      mocked(execFile).mockResolvedValue(undefined);
      const compileSpy = jest
        .spyOn(Compile, 'run')
        .mockRejectedValueOnce(new Error('mock'));

      //skip overiden by mocks
      await expect(
        executePlayground(
          mockPlaygroundInstance,
          ['first-provider'],
          { npm: 'always', ast: 'always', tsc: 'always' },
          { debugLevel: 'info' }
        )
      ).rejects.toEqual(new CLIError('superface compilation failed: mock'));

      expect(mkdir).toHaveBeenCalledTimes(1);
      expect(
        mkdir
      ).toHaveBeenCalledWith(
        'users/real/path/to/test-playground/superface/build',
        { recursive: true, mode: 0o744 }
      );

      expect(resolveSkipFile).toHaveBeenCalledTimes(2);

      expect(compileSpy).toHaveBeenCalledTimes(1);
      expect(compileSpy).toHaveBeenCalledWith([
        basepath + '/first/profile/file',
        basepath + '/first/profile/first/provider/file',
      ]);
    });

    it('executes playground correctly - executing tsc', async () => {
      mocked(mkdir).mockResolvedValue(undefined);

      mocked(resolveSkipFile)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mocked(execFile).mockResolvedValue(undefined);

      //skip overiden by mocks
      await expect(
        executePlayground(
          mockPlaygroundInstance,
          ['first-provider'],
          { npm: 'always', ast: 'always', tsc: 'always' },
          { debugLevel: 'info' }
        )
      ).resolves.toBeUndefined();

      expect(mkdir).toHaveBeenCalledTimes(1);
      expect(
        mkdir
      ).toHaveBeenCalledWith(
        'users/real/path/to/test-playground/superface/build',
        { recursive: true, mode: 0o744 }
      );

      expect(resolveSkipFile).toHaveBeenCalledTimes(3);

      expect(execFile).toHaveBeenCalledTimes(2);
      expect(execFile).toHaveBeenNthCalledWith(
        1,
        'users/real/path/to/test-playground/superface/node_modules/.bin/tsc',
        [
          '--strict',
          '--target',
          'ES2015',
          '--module',
          'commonjs',
          '--outDir',
          'users/real/path/to/test-playground/superface/build',
          '--typeRoots',
          'users/real/path/to/test-playground/superface/node_modules/@types',
          'users/real/path/to/test-playground/superface/play/first.play.ts',
        ],
        { cwd: 'users/real/path/to/test-playground' }
      );
      expect(execFile).toHaveBeenNthCalledWith(
        2,
        '/usr/local/bin/node',
        [
          'users/real/path/to/test-playground/superface/build/first.play.js',
          'first.first-provider',
        ],
        {
          cwd: 'users/real/path/to/test-playground',
          env: {
            ...process.env,
            DEBUG_COLORS: '',
            DEBUG: 'info',
          },
        },
        {
          forwardStdout: true,
          forwardStderr: true,
        }
      );
    });

    it('throws error when there is an error executing tsc', async () => {
      mocked(mkdir).mockResolvedValue(undefined);

      mocked(resolveSkipFile)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mocked(execFile).mockRejectedValueOnce({
        stderr: 'tsc-mock',
        stdout: 'tsc-mock',
      });

      //skip overiden by mocks
      await expect(
        executePlayground(
          mockPlaygroundInstance,
          ['first-provider'],
          { npm: 'always', ast: 'always', tsc: 'always' },
          { debugLevel: 'info' }
        )
      ).rejects.toEqual(new CLIError('tsc failed:\ntsc-mock'));

      expect(mkdir).toHaveBeenCalledTimes(1);
      expect(
        mkdir
      ).toHaveBeenCalledWith(
        'users/real/path/to/test-playground/superface/build',
        { recursive: true, mode: 0o744 }
      );

      expect(resolveSkipFile).toHaveBeenCalledTimes(3);

      expect(execFile).toHaveBeenCalledTimes(1);
      expect(
        execFile
      ).toHaveBeenCalledWith(
        'users/real/path/to/test-playground/superface/node_modules/.bin/tsc',
        [
          '--strict',
          '--target',
          'ES2015',
          '--module',
          'commonjs',
          '--outDir',
          'users/real/path/to/test-playground/superface/build',
          '--typeRoots',
          'users/real/path/to/test-playground/superface/node_modules/@types',
          'users/real/path/to/test-playground/superface/play/first.play.ts',
        ],
        { cwd: 'users/real/path/to/test-playground' }
      );
    });
  });
  describe('when claning playground', () => {
    const basepath = process.cwd();
    const mockPlaygroundInstance: PlaygroundInstance = {
      path: 'users/real/path/to/test-playground',
      name: 'first',
      profilePath: basepath + '/first/profile/file',
      providers: [
        {
          mapPath: basepath + '/first/profile/first/provider/file',
          name: 'first-provider',
        },
        {
          mapPath: basepath + '/first/profile/second/provider/file',
          name: 'second-provider',
        },
      ],
      scope: undefined,
    };
    it('calls rimraf on every playground file', async () => {
      mocked(rimraf).mockResolvedValue(undefined);
      await expect(
        cleanPlayground(mockPlaygroundInstance)
      ).resolves.toBeUndefined();
      expect(rimraf).toHaveBeenCalledTimes(6);
    });
  });
});
