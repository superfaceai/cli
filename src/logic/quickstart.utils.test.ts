import { SuperJson } from '@superfaceai/one-sdk';
import { ProfileId } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import { exists } from '../common/io';
import { profileExists, providerExists } from './quickstart.utils';

jest.mock('../common/io');
describe('Quickstart logic', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when checking that profile already exists', () => {
    it('returns true if source file exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);

      await expect(
        profileExists(mockSuperJson, {
          id: ProfileId.fromId('starwars/character-information'),
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
          id: ProfileId.fromId('starwars/character-information'),
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
          id: ProfileId.fromId('communication/send-email'),
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
          id: ProfileId.fromId('vcs/pull-request'),
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
