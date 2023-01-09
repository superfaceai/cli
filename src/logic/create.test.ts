import { EXTENSIONS } from '@superfaceai/ast';

import { MockLogger } from '../common';
import { createUserError } from '../common/error';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { empty as emptyProfile } from '../templates/profile';
import { createProfile } from './create';

describe('Create logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(async () => {
    logger = new MockLogger();
  });

  describe('when creating profile', () => {
    it('creates empty profile with scope', async () => {
      const mockBasePath = 'test-path';
      const mockProfile = ProfileId.fromId('test-scope/test-name', {
        userError,
      });
      const mockVersion = { major: 1 };
      const mockSuperJson = {};
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProfile(
          {
            basePath: mockBasePath,
            profile: mockProfile,
            version: mockVersion,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        'test-path/test-scope/test-name.supr',
        [
          `name = "${mockProfile.id}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty profile with scope and file name', async () => {
      const mockBasePath = 'test-path';
      const mockFilename = 'mock-filename';
      const mockProfile = ProfileId.fromId('test-scope/test-name', {
        userError,
      });
      const mockVersion = { major: 1 };
      const mockSuperJson = {};
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProfile(
          {
            basePath: mockBasePath,
            profile: mockProfile,
            version: mockVersion,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
            fileName: mockFilename,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        'test-path/mock-filename.supr',
        [
          `name = "${mockProfile.id}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty profile with scope and file name with extension', async () => {
      const mockBasePath = 'test-path';
      const mockFilename = `mock-filename${EXTENSIONS.profile.source}`;
      const mockProfile = ProfileId.fromId('test-scope/test-name', {
        userError,
      });
      const mockVersion = { major: 1 };
      const mockSuperJson = {};
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProfile(
          {
            basePath: mockBasePath,
            profile: mockProfile,
            version: mockVersion,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
            fileName: mockFilename,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        'test-path/mock-filename.supr',
        [
          `name = "${mockProfile.id}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });

    it('creates empty profile without scope', async () => {
      const mockBasePath = 'test-path';
      const mockProfile = ProfileId.fromId('test-name', { userError });
      const mockVersion = { major: 1 };
      const mockSuperJson = {};
      const mockUsecaseNames = ['test-usecase'];
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      await expect(
        createProfile(
          {
            basePath: mockBasePath,
            profile: mockProfile,
            version: mockVersion,
            usecaseNames: mockUsecaseNames,
            superJson: mockSuperJson,
          },
          { logger }
        )
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        'test-path/test-name.supr',
        [
          `name = "${mockProfile.name}"\nversion = "1.0.0"\n`,
          emptyProfile(mockUsecaseNames[0]),
        ].join(''),
        { dirs: true, force: undefined }
      );
    });
  });
});
