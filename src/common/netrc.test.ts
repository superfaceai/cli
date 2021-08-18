import { loadNetrc, saveNetrc, SUPERFACE_NETRC_HOST } from './netrc';

const mockRefreshToken = 'RT';
const mockBaseUrl = 'superface.ai';

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
          [SUPERFACE_NETRC_HOST]: {
            baseUrl: mockBaseUrl,
            password: mockRefreshToken,
          },
        },
      };
    }),
  };
});
describe('NetRc functions', () => {
  describe('when loading netrc record', () => {
    it('calls netrc correctly', () => {
      expect(loadNetrc()).toEqual({
        baseUrl: mockBaseUrl,
        refreshToken: mockRefreshToken,
      });
      expect(mockLoadSync).toHaveBeenCalled();
    });
  });

  describe('when saving netrc record', () => {
    it('calls netrc correctly', async () => {
      await expect(
        saveNetrc(mockBaseUrl, mockRefreshToken)
      ).resolves.toBeUndefined();

      expect(mockLoad).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });
  });
});
