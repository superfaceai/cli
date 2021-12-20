import { mocked } from 'ts-jest/utils';

import { getServicesUrl } from './http';
import { loadNetrc, saveNetrc } from './netrc';

jest.mock('./http');

const mockRefreshToken = 'RT';
const mockBaseUrlWithExistingRecord = 'https://existing.io';
const mockBaseUrlWithEmptyRecord = 'https://empty.io';
const mockBaseUrl = 'https://superface.ai';

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
          ['existing.io']: {
            password: mockRefreshToken,
          },
          ['empty.io']: {},
        },
      };
    }),
  };
});
describe('NetRc functions', () => {
  describe('when loading netrc record', () => {
    it('calls netrc correctly with existing record', () => {
      mocked(getServicesUrl).mockReturnValue(mockBaseUrlWithExistingRecord);
      expect(loadNetrc()).toEqual(mockRefreshToken);
      expect(mockLoadSync).toHaveBeenCalled();
    });
    it('calls netrc correctly with empty record', () => {
      mocked(getServicesUrl).mockReturnValue(mockBaseUrlWithEmptyRecord);
      expect(loadNetrc()).toBeUndefined();
      expect(mockLoadSync).toHaveBeenCalled();
    });

    it('calls netrc correctly with undefined record', () => {
      mocked(getServicesUrl).mockReturnValue(mockBaseUrl);
      expect(loadNetrc()).toBeUndefined()
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
