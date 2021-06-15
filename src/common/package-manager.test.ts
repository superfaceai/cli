import { mocked } from 'ts-jest/utils';

describe('Quickstart logic', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.resetModules();
  });
  afterEach(() => {
    jest.resetAllMocks();
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
      jest.mock('path');
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' });
      mocked(join).mockReturnValue('some/path/yarn.lock');
      mocked(exists).mockResolvedValueOnce(true);

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
      jest.mock('path');
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
      jest.mock('path');
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
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
      jest.mock('path');
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
      jest.mock('path');
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({ stderr: '', stdout: '' });
      mocked(join).mockReturnValue('some/path/package-lock.json');
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

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
      jest.mock('path');
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      mocked(join).mockReturnValue('some/path/package-lock.json');
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(
        PackageManager.installPackage('@superfaceai/one-sdk', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk'
      );

      expect(mockStdout).not.toHaveBeenCalledWith();
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
      jest.mock('path');
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      mocked(join)
        .mockReturnValueOnce('some/path/yarn.lock')
        .mockReturnValueOnce('some/path/package-lock.json')
        .mockReturnValueOnce('some/path/package.json');
      mocked(exists)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        PackageManager.installPackage('@superfaceai/one-sdk', {
          logCb: mockStdout,
          warnCb: mockStderr,
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk'
      );

      expect(mockStdout).not.toHaveBeenCalledWith();
      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "npm install @superfaceai/one-sdk" responded with: "test err"'
      );
    });

    it('installs package with npm - yarn.lock, package-lock.json and package.json not found', async () => {
      //Scope imports for every test run to ensure PackageManager isolation
      const { PackageManager } = await import('./package-manager');
      const { execShell, exists } = await import('./io');
      const { join } = await import('path');
      jest.mock('../common/io');
      jest.mock('path');
      mocked(execShell)
        .mockResolvedValueOnce({ stderr: '', stdout: 'some/path\n' })
        .mockResolvedValueOnce({
          stderr: 'test err',
          stdout: 'test out',
        });
      mocked(join)
        .mockReturnValueOnce('some/path/yarn.lock')
        .mockReturnValueOnce('some/path/package-lock.json')
        .mockReturnValueOnce('some/path/package.json');
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

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk'
      );

      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "npm install @superfaceai/one-sdk" responded with: "test err"'
      );
    });
  });
});
