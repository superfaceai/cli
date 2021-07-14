import { mocked } from 'ts-jest/utils';

describe('Package manager', () => {
  beforeEach(() => {
    jest.resetModules();
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when checking package.json existence', () => {
    const mockStderr = jest.fn();

    it('return true when package.json exists', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell).mockResolvedValue({
        stderr: '',
        stdout: 'some/path\n',
      });

      mocked(join).mockReturnValue('some/path/package.json');
      mocked(exists).mockResolvedValueOnce(true);

      await expect(
        PackageManager.packageJsonExists({
          warnCb: mockStderr,
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/package.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(mockStderr).not.toHaveBeenCalled();
    });

    it('return false when package.json does not exist', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell).mockResolvedValue({
        stderr: '',
        stdout: 'some/path\n',
      });

      mocked(join).mockReturnValue('some/path/package.json');
      mocked(exists).mockResolvedValueOnce(false);

      await expect(
        PackageManager.packageJsonExists({
          warnCb: mockStderr,
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledWith('some/path/package.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(mockStderr).not.toHaveBeenCalled();
    });

    it('return false when path does not exist', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell).mockResolvedValue({
        stderr: 'some-error',
        stdout: 'some/path\n',
      });

      mocked(join).mockReturnValue('some/path/package.json');
      mocked(exists).mockResolvedValueOnce(true);

      await expect(
        PackageManager.packageJsonExists({
          warnCb: mockStderr,
        })
      ).resolves.toEqual(false);

      expect(exists).not.toHaveBeenCalled();
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "npm prefix" responded with: "some-error"'
      );
    });
  });

  describe('when initializing package manager', () => {
    const mockStderr = jest.fn();
    const mockStdout = jest.fn();

    it('returns true for npm', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: 'some-logs' });

      mocked(join).mockReturnValue('some/path/package-lock.json');
      //Package.lock does not exist
      mocked(exists).mockResolvedValue(false);

      await expect(
        PackageManager.init('npm', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith('npm init -y');

      expect(mockStderr).not.toHaveBeenCalled();
      expect(mockStdout).toHaveBeenCalledWith('some-logs');
    });

    it('returns true for yarn', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: 'some warning', stdout: '' });

      mocked(join).mockReturnValue('some/path/yarn.lock');
      //Package.lock does not exist
      mocked(exists).mockResolvedValue(false);

      await expect(
        PackageManager.init('yarn', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith('yarn init -y');

      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "yarn init -y" responded with: "some warning"'
      );
      expect(mockStdout).not.toHaveBeenCalled();
    });

    it('returns false when pm is already initialized', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' });

      mocked(join).mockReturnValue('some/path/yarn.lock');
      //Package.lock does not exist
      mocked(exists)
        //Yarn.lock exist
        .mockResolvedValue(true);

      await expect(
        PackageManager.init('yarn', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(mockStderr).toHaveBeenCalledWith('yarn already initialized.');
      expect(mockStdout).not.toHaveBeenCalled();
    });
  });
  describe('when getting used package manager', () => {
    const mockStderr = jest.fn();

    it('returns undefined - err on npm prefix', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell } = await import('./io');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell).mockResolvedValue({
        stderr: 'npm prefix err',
        stdout: 'some/path\n',
      });

      await expect(
        PackageManager.getUsedPm({
          warnCb: mockStderr,
        })
      ).resolves.toBeUndefined();

      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "npm prefix" responded with: "npm prefix err"'
      );
    });

    it('returns yarn - normalized ./ path', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell).mockResolvedValue({
        stderr: '',
        stdout: process.cwd(),
      });
      mocked(join).mockReturnValue('some/path/yarn.lock');
      mocked(exists).mockResolvedValueOnce(true);

      await expect(
        PackageManager.getUsedPm({
          warnCb: mockStderr,
        })
      ).resolves.toEqual('yarn');

      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(mockStderr).not.toHaveBeenCalled();
    });
  });
  describe('when installing package', () => {
    const mockStdout = jest.fn();
    const mockStderr = jest.fn();

    it('installs package with yarn and empty stdout, stderror', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' });
      mocked(join).mockReturnValue('some/path/yarn.lock');
      mocked(exists).mockResolvedValueOnce(true).mockResolvedValueOnce(true);

      await expect(
        PackageManager.installPackage('@superfaceai/one-sdk', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith('yarn add @superfaceai/one-sdk');

      expect(mockStdout).not.toHaveBeenCalled();
      expect(mockStderr).not.toHaveBeenCalled();
    });

    it('installs package with yarn and empty stdout, stderror, cached used package manager', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' })
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' });
      mocked(join).mockReturnValue('some/path/yarn.lock');
      mocked(exists).mockResolvedValue(true);

      await expect(
        PackageManager.installPackage('@superfaceai/one-sdk', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledTimes(2);
      expect(execShell).toHaveBeenNthCalledWith(1, 'npm prefix');
      expect(execShell).toHaveBeenNthCalledWith(
        2,
        'yarn add @superfaceai/one-sdk'
      );

      expect(mockStdout).not.toHaveBeenCalled();
      expect(mockStderr).not.toHaveBeenCalled();

      //Second install to check caching
      await expect(
        PackageManager.installPackage('@superfaceai/one-sdk', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(true);

      //execShell is called three times (it only calls npm prefix once)
      expect(execShell).toHaveBeenCalledTimes(3);
      expect(execShell).toHaveBeenNthCalledWith(
        3,
        'yarn add @superfaceai/one-sdk'
      );
    });

    it('installs package with yarn', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      mocked(join).mockReturnValue('some/path/yarn.lock');
      mocked(exists).mockResolvedValueOnce(true).mockResolvedValueOnce(true);

      await expect(
        PackageManager.installPackage('@superfaceai/one-sdk', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledWith('yarn add @superfaceai/one-sdk');

      expect(mockStdout).not.toHaveBeenCalledWith();
      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "yarn add @superfaceai/one-sdk" responded with: "test err"'
      );
    });

    it('installs package with yarn - err on npm prefix', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell)
        .mockResolvedValueOnce({
          stderr: 'npm prefix err',
          stdout: 'some/path\n',
        })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      mocked(join).mockReturnValue('some/path/yarn.lock');
      mocked(exists).mockResolvedValueOnce(true);

      await expect(
        PackageManager.installPackage('@superfaceai/one-sdk', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(false);

      expect(exists).not.toHaveBeenCalled();
      expect(execShell).not.toHaveBeenCalledWith(
        'yarn add @superfaceai/one-sdk'
      );

      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "npm prefix" responded with: "npm prefix err"'
      );
    });

    it('installs package with npm and empty stdout, stderror', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' });
      mocked(join).mockReturnValue('some/path/package-lock.json');
      mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        PackageManager.installPackage('@superfaceai/one-sdk', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk'
      );

      expect(mockStdout).not.toHaveBeenCalled();
      expect(mockStderr).not.toHaveBeenCalled();
    });

    it('installs package with npm', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      mocked(join).mockReturnValue('some/path/package-lock.json');
      mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        PackageManager.installPackage('@superfaceai/one-sdk', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk'
      );

      expect(mockStdout).toHaveBeenCalledWith('test out');
      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "npm install @superfaceai/one-sdk" responded with: "test err"'
      );
    });

    it('installs package with npm - yarn.lock and package-lock.json not found', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      mocked(join)
        .mockReturnValueOnce('some/path/package.json')
        .mockReturnValueOnce('some/path/yarn.lock')
        .mockReturnValueOnce('some/path/package-lock.json');
      mocked(exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      await expect(
        PackageManager.installPackage('@superfaceai/one-sdk', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk'
      );

      expect(mockStdout).toHaveBeenCalledWith('test out');
      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "npm install @superfaceai/one-sdk" responded with: "test err"'
      );
    });

    it('does not install package without package.json', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path', () => ({
        ...jest.requireActual<Record<string, unknown>>('path'),
        join: jest.fn(),
      }));
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      mocked(join)
        .mockReturnValueOnce('some/path/package.json')
        .mockReturnValueOnce('some/path/yarn.lock')
        .mockReturnValueOnce('some/path/package-lock.json');
      mocked(exists)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      await expect(
        PackageManager.installPackage('@superfaceai/one-sdk', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledWith('some/path/package.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(mockStderr).toHaveBeenCalledWith(
        'Unable to install package @superfaceai/one-sdk without initialized package.json'
      );
    });
  });
});
