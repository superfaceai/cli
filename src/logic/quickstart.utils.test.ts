import { CLIError } from '@oclif/errors';
import { err, ok, SuperJson } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { execShell, exists } from '../common/io';
import {
  getProviders,
  installSdk,
  profileExists,
  providerExists,
} from './quickstart.utils';

jest.mock('../common/io');
describe('Quickstart logic', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when installing sdk', () => {
    const mockStdout = jest.fn();
    const mockStderr = jest.fn();

    it('installs sdk with yarn and empty stdout, stderror', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(execShell).mockResolvedValue({ stderr: '', stdout: '' });

      await expect(
        installSdk({ logCb: mockStdout, warnCb: mockStderr })
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith('yarn.lock');
      expect(execShell).toHaveBeenCalledWith('yarn add @superfaceai/one-sdk');

      expect(mockStdout).not.toHaveBeenCalled();
      expect(mockStderr).not.toHaveBeenCalled();
    });

    it('installs sdk with yarn', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(execShell).mockResolvedValue({
        stderr: 'test err',
        stdout: 'test out',
      });

      await expect(
        installSdk({ logCb: mockStdout, warnCb: mockStderr })
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith('yarn.lock');
      expect(execShell).toHaveBeenCalledWith('yarn add @superfaceai/one-sdk');

      expect(mockStdout).toHaveBeenCalledWith('test out');
      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "npm install @superfaceai/one-sdk" responded with: "test err"'
      );
    });

    it('installs sdk with npm and empty stdout, stderror', async () => {
      mocked(exists).mockResolvedValue(false);
      mocked(execShell).mockResolvedValue({ stderr: '', stdout: '' });

      await expect(
        installSdk({ logCb: mockStdout, warnCb: mockStderr })
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith('yarn.lock');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk'
      );

      expect(mockStdout).not.toHaveBeenCalled();
      expect(mockStderr).not.toHaveBeenCalled();
    });

    it('installs sdk with npm', async () => {
      mocked(exists).mockResolvedValue(false);
      mocked(execShell).mockResolvedValue({
        stderr: 'test err',
        stdout: 'test out',
      });

      await expect(
        installSdk({ logCb: mockStdout, warnCb: mockStderr })
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith('yarn.lock');
      expect(execShell).toHaveBeenCalledWith(
        'npm install @superfaceai/one-sdk'
      );

      expect(mockStdout).toHaveBeenCalledWith('test out');
      expect(mockStderr).toHaveBeenCalledWith(
        'Shell command "npm install @superfaceai/one-sdk" responded with: "test err"'
      );
    });
  });

  describe('when geting providers', () => {
    const originalLoad = SuperJson.load;

    afterEach(() => {
      jest.resetAllMocks();
    });

    afterAll(() => {
      SuperJson.load = originalLoad;
    });
    it('returns correct providers', async () => {
      const mockLoad = jest.fn().mockResolvedValue(
        ok(
          new SuperJson({
            profiles: {
              ['communication/send-email']: {
                version: '1.0.1',
                providers: {
                  sendgrid: {},
                  mock: {},
                },
              },
            },
            providers: {
              sendgrid: {
                security: [
                  {
                    id: 'bearer_token',
                    token: '$SENDGRID_TOKEN',
                  },
                ],
              },
              mock: {
                security: [],
              },
            },
          })
        )
      );
      SuperJson.load = mockLoad;

      await expect(getProviders('.')).resolves.toEqual({
        sendgrid: {
          security: [
            {
              id: 'bearer_token',
              token: '$SENDGRID_TOKEN',
            },
          ],
        },
        mock: {
          security: [],
        },
      });
    });

    it('throws when there is an error', async () => {
      const mockLoad = jest.fn().mockResolvedValue(err('test'));
      SuperJson.load = mockLoad;

      await expect(getProviders('.')).rejects.toEqual(new CLIError('test'));
    });
  });

  describe('when checking that profile already exists', () => {
    it('returns true if source file exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);

      await expect(
        profileExists(mockSuperJson, {
          profile: 'character-information',
          scope: 'starwars',
          version: '1.0.0',
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledTimes(1);
    });

    it('returns false if source file does not exist', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(false);

      await expect(
        profileExists(mockSuperJson, {
          profile: 'character-information',
          scope: 'starwars',
          version: '1.0.0',
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledTimes(1);
    });

    it('returns true if there is correct file property', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          ['communication/send-email']: {
            file: 'some/path',
            providers: {
              sendgrid: {},
            },
          },
        },
        providers: {
          sendgrid: {
            security: [],
          },
        },
      });
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(
        profileExists(mockSuperJson, {
          scope: 'communication',
          profile: 'send-email',
          version: '1.0.0',
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledTimes(2);
    });

    it('returns false if there is different file property', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          ['communication/send-email']: {
            file: 'some/path',
            providers: {
              sendgrid: {},
            },
          },
        },
        providers: {
          sendgrid: {
            security: [],
          },
        },
      });
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(
        profileExists(mockSuperJson, {
          scope: 'vcs',
          profile: 'pull-request',
          version: '1.0.0',
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledTimes(1);
    });
  });

  describe('when checking that provider already exists', () => {
    it('returns true if provider is defined in super.json', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          ['communication/send-email']: {
            file: 'some/path',
            providers: {
              sendgrid: {},
            },
          },
        },
        providers: {
          sendgrid: {
            security: [],
          },
        },
      });

      expect(providerExists(mockSuperJson, 'sendgrid')).toEqual(true);
    });

    it('returns false if source file does not exist', async () => {
      const mockSuperJson = new SuperJson();

      expect(providerExists(mockSuperJson, 'sendgrid')).toEqual(false);
    });
  });
});
