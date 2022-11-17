import { join } from 'path';

import { MockLogger } from '.';
import { execShell, exists } from './io';
import { PackageManager } from './package-manager';

jest.mock('../common/io');
jest.mock('path', () => ({
  ...jest.requireActual<Record<string, unknown>>('path'),
  join: jest.fn(),
}));

describe('Package manager', () => {
  let packageManager: PackageManager;
  let logger: MockLogger;

  beforeEach(() => {
    logger = new MockLogger();
    packageManager = new PackageManager(logger);
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when checking package.json existence', () => {
    it('return true when package.json exists', async () => {
      jest.mocked(execShell).mockResolvedValue({
        stderr: '',
        stdout: 'some/path\n',
      });

      jest.mocked(join).mockReturnValue('some/path/package.json');
      jest.mocked(exists).mockResolvedValueOnce(true);

      await expect(packageManager.packageJsonExists()).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/package.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(logger.stderr).toEqual([]);
    });

    it('return false when package.json does not exist', async () => {
      jest.mocked(execShell).mockResolvedValue({
        stderr: '',
        stdout: 'some/path\n',
      });

      jest.mocked(join).mockReturnValue('some/path/package.json');
      jest.mocked(exists).mockResolvedValueOnce(false);

      await expect(packageManager.packageJsonExists()).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledWith('some/path/package.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(logger.stderr).toEqual([]);
    });

    it('return false when path does not exist', async () => {
      jest.mocked(execShell).mockResolvedValue({
        stderr: 'some-error',
        stdout: 'some/path\n',
      });

      jest.mocked(join).mockReturnValue('some/path/package.json');
      jest.mocked(exists).mockResolvedValueOnce(true);

      await expect(packageManager.packageJsonExists()).resolves.toEqual(false);

      expect(exists).not.toHaveBeenCalled();
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(logger.stderr).toContainEqual([
        'shellCommandError',
        ['npm prefix', 'some-error'],
      ]);
    });
  });

  describe('when initializing package manager', () => {
    it('returns true for npm', async () => {
      jest
        .mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: 'some-logs' });

      jest.mocked(join).mockReturnValue('some/path/package-lock.json');
      // Package.lock does not exist
      jest.mocked(exists).mockResolvedValue(false);

      await expect(packageManager.init('npm')).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith('npm init -y');

      expect(logger.stderr).toEqual([]);
      expect(logger.stdout).toContainEqual([
        'initPmOnPath',
        ['npm', process.cwd()],
      ]);
      expect(logger.stdout).toContainEqual(['stdout', ['some-logs']]);
    });

    it('returns true for yarn', async () => {
      jest
        .mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: 'some warning', stdout: '' });

      jest.mocked(join).mockReturnValue('some/path/yarn.lock');
      // Package.lock does not exist
      jest.mocked(exists).mockResolvedValue(false);

      await expect(packageManager.init('yarn')).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith('yarn init -y');

      expect(logger.stderr).toContainEqual([
        'shellCommandError',
        ['yarn init -y', 'some warning'],
      ]);
      expect(logger.stdout).toContainEqual([
        'initPmOnPath',
        ['yarn', process.cwd()],
      ]);
    });

    it('returns false when pm is already initialized', async () => {
      jest
        .mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' });

      jest.mocked(join).mockReturnValue('some/path/yarn.lock');
      // Package.lock does not exist
      jest
        .mocked(exists)
        // Yarn.lock exist
        .mockResolvedValue(true);

      await expect(packageManager.init('yarn')).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(logger.stderr).toContainEqual(['pmAlreadyInitialized', ['yarn']]);
      expect(logger.stdout).toEqual([]);
    });
  });

  describe('when getting used package manager', () => {
    it('returns undefined - err on npm prefix', async () => {
      jest.mocked(execShell).mockResolvedValue({
        stderr: 'npm prefix err',
        stdout: 'some/path\n',
      });

      await expect(packageManager.getUsedPm()).resolves.toBeUndefined();

      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(logger.stderr).toContainEqual([
        'shellCommandError',
        ['npm prefix', 'npm prefix err'],
      ]);
    });

    it('returns yarn - normalized ./ path', async () => {
      jest.mocked(execShell).mockResolvedValue({
        stderr: '',
        stdout: process.cwd(),
      });
      jest.mocked(join).mockReturnValue('some/path/yarn.lock');
      jest.mocked(exists).mockResolvedValueOnce(true);

      await expect(packageManager.getUsedPm()).resolves.toEqual('yarn');

      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(logger.stderr).toEqual([]);
    });
  });

  describe('when installing package', () => {
    it('installs package with yarn and empty stdout, stderror', async () => {
      jest
        .mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' });
      jest.mocked(join).mockReturnValue('some/path/yarn.lock');
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await expect(
        packageManager.installPackage('@superfaceai/one-sdk')
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith('yarn add @superfaceai/one-sdk', {
        cwd: 'some/path',
      });

      expect(logger.stdout).toContainEqual([
        'installPackageOnPath',
        ['@superfaceai/one-sdk', 'some/path', 'yarn add @superfaceai/one-sdk'],
      ]);
      expect(logger.stderr).toEqual([]);
    });

    it('installs package with yarn and empty stdout, stderror, cached used package manager', async () => {
      jest
        .mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' })
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' });
      jest.mocked(join).mockReturnValue('some/path/yarn.lock');
      jest.mocked(exists).mockResolvedValue(true);

      await expect(
        packageManager.installPackage('@superfaceai/one-sdk')
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledTimes(2);
      expect(execShell).toHaveBeenNthCalledWith(1, 'npm prefix');
      expect(execShell).toHaveBeenNthCalledWith(
        2,
        'yarn add @superfaceai/one-sdk',
        { cwd: 'some/path' }
      );

      expect(logger.stdout).toContainEqual([
        'installPackageOnPath',
        ['@superfaceai/one-sdk', 'some/path', 'yarn add @superfaceai/one-sdk'],
      ]);
      expect(logger.stderr).toEqual([]);

      // Second install to check caching
      await expect(
        packageManager.installPackage('@superfaceai/one-sdk')
      ).resolves.toEqual(true);

      // execShell is called three times (it only calls npm prefix once)
      expect(execShell).toHaveBeenCalledTimes(3);
      expect(execShell).toHaveBeenNthCalledWith(
        3,
        'yarn add @superfaceai/one-sdk',
        { cwd: 'some/path' }
      );
    });

    it('installs package with yarn', async () => {
      jest
        .mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      jest.mocked(join).mockReturnValue('some/path/yarn.lock');
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await expect(
        packageManager.installPackage('@superfaceai/one-sdk')
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledWith('yarn add @superfaceai/one-sdk', {
        cwd: 'some/path',
      });

      expect(logger.stdout).toContainEqual([
        'installPackageOnPath',
        ['@superfaceai/one-sdk', 'some/path', 'yarn add @superfaceai/one-sdk'],
      ]);
      expect(logger.stdout).toContainEqual(['stdout', ['test out']]);
      expect(logger.stderr).toContainEqual([
        'shellCommandError',
        ['yarn add @superfaceai/one-sdk', 'test err'],
      ]);
    });

    it('installs package with yarn - err on npm prefix', async () => {
      jest
        .mocked(execShell)
        .mockResolvedValueOnce({
          stderr: 'npm prefix err',
          stdout: 'some/path\n',
        })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      jest.mocked(join).mockReturnValue('some/path/yarn.lock');
      jest.mocked(exists).mockResolvedValueOnce(true);

      await expect(
        packageManager.installPackage('@superfaceai/one-sdk')
      ).resolves.toEqual(false);

      expect(exists).not.toHaveBeenCalled();
      expect(execShell).not.toHaveBeenCalledWith(
        'yarn add @superfaceai/one-sdk'
      );

      expect(logger.stderr).toContainEqual([
        'shellCommandError',
        ['npm prefix', 'npm prefix err'],
      ]);

      expect(logger.stderr).toContainEqual([
        'pmNotInitialized',
        ['@superfaceai/one-sdk'],
      ]);
    });

    it('installs package with npm and empty stdout, stderror', async () => {
      jest
        .mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' });
      jest.mocked(join).mockReturnValue('some/path/package-lock.json');
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        packageManager.installPackage('@superfaceai/one-sdk')
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk',
        { cwd: 'some/path' }
      );

      expect(logger.stdout).toContainEqual([
        'installPackageOnPath',
        [
          '@superfaceai/one-sdk',
          'some/path',
          'npm install @superfaceai/one-sdk',
        ],
      ]);
      expect(logger.stderr).toEqual([]);
    });

    it('installs package with npm', async () => {
      jest
        .mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      jest.mocked(join).mockReturnValue('some/path/package-lock.json');
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        packageManager.installPackage('@superfaceai/one-sdk')
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk',
        { cwd: 'some/path' }
      );

      expect(logger.stdout).toContainEqual([
        'installPackageOnPath',
        [
          '@superfaceai/one-sdk',
          'some/path',
          'npm install @superfaceai/one-sdk',
        ],
      ]);
      expect(logger.stdout).toContainEqual(['stdout', ['test out']]);

      expect(logger.stderr).toContainEqual([
        'shellCommandError',
        ['npm install @superfaceai/one-sdk', 'test err'],
      ]);
    });

    it('installs package with npm - yarn.lock and package-lock.json not found', async () => {
      jest
        .mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      jest
        .mocked(join)
        .mockReturnValueOnce('some/path/package.json')
        .mockReturnValueOnce('some/path/yarn.lock')
        .mockReturnValueOnce('some/path/package-lock.json');
      jest
        .mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      await expect(
        packageManager.installPackage('@superfaceai/one-sdk')
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk',
        { cwd: 'some/path' }
      );
      expect(logger.stdout).toContainEqual([
        'installPackageOnPath',
        [
          '@superfaceai/one-sdk',
          'some/path',
          'npm install @superfaceai/one-sdk',
        ],
      ]);
      expect(logger.stdout).toContainEqual(['stdout', ['test out']]);
      expect(logger.stderr).toContainEqual([
        'shellCommandError',
        ['npm install @superfaceai/one-sdk', 'test err'],
      ]);
    });

    it('does not install package without package.json', async () => {
      jest
        .mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      jest
        .mocked(join)
        .mockReturnValueOnce('some/path/package.json')
        .mockReturnValueOnce('some/path/yarn.lock')
        .mockReturnValueOnce('some/path/package-lock.json');
      jest
        .mocked(exists)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      await expect(
        packageManager.installPackage('@superfaceai/one-sdk')
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledWith('some/path/package.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(logger.stderr).toContainEqual([
        'pmNotInitialized',
        ['@superfaceai/one-sdk'],
      ]);
    });
  });
});
