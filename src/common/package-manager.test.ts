import { join } from 'path';
import { mocked } from 'ts-jest/utils';

import { execShell, exists } from './io';
import { PackageManager } from './package-manager';

jest.mock('../common/io');
jest.mock('path');

describe('Quickstart logic', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  describe('when getting used package manager', () => {
    const mockStdout = jest.fn();
    const mockStderr = jest.fn();

    it('returns yarn', async () => {
      mocked(execShell).mockResolvedValueOnce({
        stderr: '',
        stdout: 'some/path\n',
      });
      mocked(join).mockReturnValue('some/path/yarn.lock');
      mocked(exists).mockResolvedValueOnce(true);

      await expect(
        PackageManager.getUsedPm({ warnCb: mockStderr })
      ).resolves.toEqual('yarn');

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(mockStdout).not.toHaveBeenCalled();
      expect(mockStderr).not.toHaveBeenCalled();
    });

    it('returns npm', async () => {
      mocked(execShell).mockResolvedValueOnce({
        stderr: '',
        stdout: 'some/path\n',
      });
      mocked(join).mockReturnValue('some/path/package-lock.json');
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(
        PackageManager.getUsedPm({ warnCb: mockStderr })
      ).resolves.toEqual('npm');

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(mockStdout).not.toHaveBeenCalled();
      expect(mockStderr).not.toHaveBeenCalled();
    });

    it('returns undefined - error during npm prefix', async () => {
      mocked(execShell).mockResolvedValueOnce({
        stderr: 'this is not fine',
        stdout: 'some/path\n',
      });

      await expect(
        PackageManager.getUsedPm({ warnCb: mockStderr })
      ).resolves.toEqual(undefined);

      expect(execShell).toHaveBeenCalledWith('npm prefix');

      expect(mockStdout).not.toHaveBeenCalled();
      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "npm prefix" responded with: "this is not fine"'
      );
    });

    it('returns undefined - unable to find lock file', async () => {
      mocked(execShell).mockResolvedValueOnce({
        stderr: '',
        stdout: 'some/path\n',
      });
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(false);
      mocked(join)
        .mockReturnValueOnce('some/path/yarn.lock')
        .mockReturnValueOnce('some/path/package-lock.json');

      await expect(
        PackageManager.getUsedPm({ warnCb: mockStderr })
      ).resolves.toEqual(undefined);

      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');

      expect(mockStdout).not.toHaveBeenCalled();
      expect(mockStderr).toHaveBeenCalledWith('Unable to locate package.json');
    });
  });
  describe('when installing package', () => {
    const mockStdout = jest.fn();
    const mockStderr = jest.fn();

    it('installs package with yarn and empty stdout, stderror', async () => {
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
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith('yarn add @superfaceai/one-sdk');

      expect(mockStdout).not.toHaveBeenCalled();
      expect(mockStderr).not.toHaveBeenCalled();
    });

    it('installs package with yarn', async () => {
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
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith('some/path/yarn.lock');
      expect(execShell).toHaveBeenCalledWith('yarn add @superfaceai/one-sdk');

      expect(mockStdout).toHaveBeenCalledWith('test out');
      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "yarn add @superfaceai/one-sdk" responded with: "test err"'
      );
    });

    it('installs package with npm and empty stdout, stderror', async () => {
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
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith('some/path/package-lock.json');
      expect(execShell).toHaveBeenCalledWith('npm prefix');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk'
      );

      expect(mockStdout).not.toHaveBeenCalled();
      expect(mockStderr).not.toHaveBeenCalled();
    });

    it('installs package with npm', async () => {
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
      ).resolves.toBeUndefined();

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
  });
});
