import { ServiceClient } from '@superfaceai/service-client';
import { mocked } from 'ts-jest/utils';

import { getStoreUrl } from '../common/http';
import { login } from '../logic/login';
import { MockStd, mockStd } from '../test/mock-std';
import Login from './login';

const mockRefreshToken = 'RT';
const mockBaseUrlWithExistingRecord = 'existing';
const mockBaseUrlWithEmptyRecord = 'empty';

jest.mock('../logic/login');
jest.mock('../common/http', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/http'),
  getStoreUrl: jest.fn(),
}));

const mockLoadSync = jest.fn();
const mockSave = jest.fn();
const mockLoad = jest.fn();

jest.mock('netrc-parser', () => {
  return {
    //Netrc is not default export so we need this
    Netrc: jest.fn().mockImplementation(() => {
      return {
        loadSync: mockLoadSync,
        save: mockSave,
        load: mockLoad,
        machines: {
          [mockBaseUrlWithExistingRecord]: {
            password: mockRefreshToken,
          },
          [mockBaseUrlWithEmptyRecord]: {},
        },
      };
    }),
  };
});

describe('Login CLI command', () => {
  const originalValue = process.env.SUPERFACE_REFRESH_TOKEN;
  const logoutSpy = jest.spyOn(ServiceClient.prototype, 'logout');

  let stdout: MockStd;
  let stderr: MockStd;

  beforeEach(async () => {
    mockSave.mockClear();
    mockLoad.mockClear();
    mockLoadSync.mockClear();

    logoutSpy.mockClear();
    stdout = mockStd();
    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
    stderr = mockStd();
    jest
      .spyOn(process['stderr'], 'write')
      .mockImplementation(stderr.implementation);
  });

  afterAll(() => {
    if (originalValue) {
      process.env.SUPERFACE_REFRESH_TOKEN = originalValue;
    }
  });

  describe('when running login command', () => {
    it('calls login correctly - non existing record in netrc', async () => {
      mocked(getStoreUrl).mockReturnValue(mockBaseUrlWithEmptyRecord);

      await expect(Login.run([])).resolves.toBeUndefined();
      expect(login).toHaveBeenCalledWith({
        logCb: expect.anything(),
        warnCb: expect.anything(),
        force: false,
      });

      expect(logoutSpy).not.toHaveBeenCalled();
      expect(stdout.output).toContain('Logged in');
    });

    it('calls login correctly - non existing record in netrc and quiet flag', async () => {
      mocked(getStoreUrl).mockReturnValue(mockBaseUrlWithEmptyRecord);
      const logoutSpy = jest.spyOn(ServiceClient.prototype, 'logout');

      await expect(Login.run(['-q'])).resolves.toBeUndefined();
      expect(login).toHaveBeenCalledWith({
        logCb: undefined,
        warnCb: undefined,
        force: false,
      });

      expect(logoutSpy).not.toHaveBeenCalled();
      expect(stdout.output).toEqual('');
    });
    it('calls login correctly - existing record in netrc and force flag', async () => {
      mocked(getStoreUrl).mockReturnValue(mockBaseUrlWithExistingRecord);
      const logoutSpy = jest
        .spyOn(ServiceClient.prototype, 'logout')
        .mockResolvedValue(undefined);

      await expect(Login.run(['-f'])).resolves.toBeUndefined();

      expect(login).toHaveBeenCalledWith({
        logCb: expect.anything(),
        warnCb: expect.anything(),
        force: true,
      });

      expect(logoutSpy).toHaveBeenCalled();
      expect(stdout.output).toContain('Already logged in, logging out');
      expect(stdout.output).toContain('Logged in');
    });

    it('calls login correctly - refresh token in env', async () => {
      process.env.SUPERFACE_REFRESH_TOKEN = mockRefreshToken;
      mocked(getStoreUrl).mockReturnValue(mockBaseUrlWithExistingRecord);
      const logoutSpy = jest.spyOn(ServiceClient.prototype, 'logout');

      await expect(Login.run([])).resolves.toBeUndefined();
      expect(login).toHaveBeenCalledWith({
        logCb: expect.anything(),
        warnCb: expect.anything(),
        force: false,
      });

      expect(logoutSpy).not.toHaveBeenCalled();
      expect(stdout.output).toContain(
        `Using value from SUPERFACE_REFRESH_TOKEN environment variable`
      );
      expect(stdout.output).toContain('Logged in');
    });
  });
});
