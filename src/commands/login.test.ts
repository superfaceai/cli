import { ServiceClient } from '@superfaceai/service-client';
import { mocked } from 'ts-jest/utils';

import { MockLogger } from '..';
import { createUserError } from '../common/error';
import { getServicesUrl } from '../common/http';
import { login } from '../logic/login';
import { CommandInstance } from '../test/utils';
import Login from './login';

const mockRefreshToken = 'RT';
const mockBaseUrlWithExistingRecord = 'existing';
const mockBaseUrlWithEmptyRecord = 'empty';

jest.mock('../logic/login');
jest.mock('../common/http', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/http'),
  getServicesUrl: jest.fn(),
}));

const mockLoadSync = jest.fn();
const mockSave = jest.fn();
const mockLoad = jest.fn();

jest.mock('netrc-parser', () => {
  return {
    // Netrc is not default export so we need this
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
  let logger: MockLogger;
  let instance: Login;
  const userError = createUserError(false);

  beforeEach(async () => {
    jest.restoreAllMocks();
    logger = new MockLogger();
    instance = CommandInstance(Login);
  });

  afterAll(() => {
    if (originalValue !== undefined) {
      process.env.SUPERFACE_REFRESH_TOKEN = originalValue;
    }
  });

  describe('when running login command', () => {
    it('calls login correctly - non existing record in netrc', async () => {
      mocked(getServicesUrl).mockReturnValue(mockBaseUrlWithEmptyRecord);
      const logoutSpy = jest.spyOn(ServiceClient.prototype, 'logout');

      await expect(
        instance.execute({ logger, userError, flags: { force: false } })
      ).resolves.toBeUndefined();
      expect(login).toHaveBeenCalledWith(
        {
          force: false,
        },
        expect.anything()
      );

      expect(logoutSpy).not.toHaveBeenCalled();
      expect(logger.stdout).toContainEqual(['loggedInSuccessfully', []]);
    });

    it('calls login correctly - non existing record in netrc and quiet flag', async () => {
      mocked(getServicesUrl).mockReturnValue(mockBaseUrlWithEmptyRecord);
      const logoutSpy = jest.spyOn(ServiceClient.prototype, 'logout');

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            force: false,
            quiet: true,
          },
        })
      ).resolves.toBeUndefined();
      expect(login).toHaveBeenCalledWith(
        {
          force: false,
        },
        expect.anything()
      );

      expect(logoutSpy).not.toHaveBeenCalled();
      expect(logger.stdout).toContainEqual(['loggedInSuccessfully', []]);
    });

    it('calls login correctly - existing record in netrc and force flag', async () => {
      mocked(getServicesUrl).mockReturnValue(mockBaseUrlWithExistingRecord);
      const logoutSpy = jest.spyOn(ServiceClient.prototype, 'logout');

      await expect(
        instance.execute({ logger, userError, flags: { force: true } })
      ).resolves.toBeUndefined();

      expect(login).toHaveBeenCalledWith(
        {
          force: true,
        },
        expect.anything()
      );

      expect(logger.stdout).toContainEqual(['alreadyLoggedIn', []]);
      expect(logger.stdout).toContainEqual(['loggedInSuccessfully', []]);
      expect(logoutSpy).toHaveBeenCalled();
    });

    it('calls login correctly - refresh token in env', async () => {
      process.env.SUPERFACE_REFRESH_TOKEN = mockRefreshToken;
      mocked(getServicesUrl).mockReturnValue(mockBaseUrlWithExistingRecord);
      const logoutSpy = jest.spyOn(ServiceClient.prototype, 'logout');

      await expect(
        instance.execute({ logger, userError, flags: { force: false } })
      ).resolves.toBeUndefined();
      expect(login).toHaveBeenCalledWith(
        {
          force: false,
        },
        expect.anything()
      );

      expect(logger.stdout).toContainEqual(['usinfSfRefreshToken', []]);
      expect(logger.stdout).toContainEqual(['loggedInSuccessfully', []]);
      expect(logoutSpy).not.toHaveBeenCalled();
    });
  });
});
