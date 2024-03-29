import { getServicesUrl } from './http';
import { loadNetrc, saveNetrc } from './netrc';

jest.mock('./http');

const mockRefreshToken = 'RT';
const mockBaseUrlWithExistingRecord = 'existing';
const mockBaseUrlWithEmptyRecord = 'empty';
const mockBaseUrl = 'superface.ai';

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

describe('NetRc functions', () => {
  describe('when loading netrc record', () => {
    it('calls netrc correctly with existing record', () => {
      jest
        .mocked(getServicesUrl)
        .mockReturnValue(mockBaseUrlWithExistingRecord);
      expect(loadNetrc()).toEqual({
        baseUrl: mockBaseUrlWithExistingRecord,
        refreshToken: mockRefreshToken,
      });
      expect(mockLoadSync).toHaveBeenCalled();
    });

    it('calls netrc correctly with empty record', () => {
      jest.mocked(getServicesUrl).mockReturnValue(mockBaseUrlWithEmptyRecord);
      expect(loadNetrc()).toEqual({
        baseUrl: mockBaseUrlWithEmptyRecord,
        refreshToken: undefined,
      });
      expect(mockLoadSync).toHaveBeenCalled();
    });

    it('calls netrc correctly with undefined record', () => {
      jest.mocked(getServicesUrl).mockReturnValue(mockBaseUrl);
      expect(loadNetrc()).toEqual({
        baseUrl: mockBaseUrl,
        refreshToken: undefined,
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

    it('calls netrc correctly with null refresh token', async () => {
      await expect(saveNetrc(mockBaseUrl, null)).resolves.toBeUndefined();

      expect(mockLoad).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });
  });
});
