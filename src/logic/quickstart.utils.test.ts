import { createUserError } from '../common/error';
import { exists } from '../common/io';
import { ProfileId } from '../common/profile';
import { profileExists, providerExists } from './quickstart.utils';

jest.mock('../common/io');

describe('Quickstart logic', () => {
  const userError = createUserError(false, false);

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when checking that profile already exists', () => {
    it('returns true if source file exists', async () => {
      const mockSuperJson = {};
      jest.mocked(exists).mockResolvedValue(true);

      await expect(
        profileExists(mockSuperJson, '', {
          id: ProfileId.fromId('starwars/character-information', { userError }),
          version: '1.0.0',
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledTimes(1);
    });

    it('returns false if source file does not exist', async () => {
      const mockSuperJson = {};
      jest.mocked(exists).mockResolvedValue(false);

      await expect(
        profileExists(mockSuperJson, '', {
          id: ProfileId.fromId('starwars/character-information', { userError }),
          version: '1.0.0',
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledTimes(1);
    });

    it('returns true if there is correct file property', async () => {
      const mockSuperJson = {
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
      };
      jest
        .mocked(exists)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        profileExists(mockSuperJson, '', {
          id: ProfileId.fromId('communication/send-email', { userError }),
          version: '1.0.0',
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledTimes(2);
    });

    it('returns false if there is different file property', async () => {
      const mockSuperJson = {
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
      };
      jest
        .mocked(exists)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        profileExists(mockSuperJson, '', {
          id: ProfileId.fromId('vcs/pull-request', { userError }),
          version: '1.0.0',
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledTimes(1);
    });
  });

  describe('when checking that provider already exists', () => {
    it('returns true if provider is defined in super.json', async () => {
      const mockSuperJson = {
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
      };

      expect(providerExists(mockSuperJson, 'sendgrid')).toEqual(true);
    });

    it('returns false if source file does not exist', async () => {
      const mockSuperJson = {};

      expect(providerExists(mockSuperJson, 'sendgrid')).toEqual(false);
    });
  });
});
