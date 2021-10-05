import { CLIError } from '@oclif/errors';
import { ok, SuperJson } from '@superfaceai/one-sdk';
import { ProfileId, ProfileVersion } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import { composeUsecaseName } from '../common/document';
import { mkdir, mkdirQuiet } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { createProfile } from './create';
import { generateSpecifiedProfiles, initSuperface } from './init';

//Mock io
jest.mock('../common/io', () => ({
  mkdir: jest.fn(),
  mkdirQuiet: jest.fn(),
}));

//Mock create profile
jest.mock('./create', () => ({
  createProfile: jest.fn(),
}));

describe('Init logic', () => {
  describe('when initialing superface', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('creates correct files', async () => {
      const mockAppPath = 'test';
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson({})));

      mocked(mkdirQuiet).mockResolvedValue(true);
      mocked(mkdir).mockResolvedValue('test');

      await expect(initSuperface(mockAppPath)).resolves.not.toBeUndefined();

      expect(mkdir).toHaveBeenCalledTimes(1);
      expect(mkdir).toHaveBeenCalledWith(mockAppPath, { recursive: true });

      expect(mkdirQuiet).toHaveBeenNthCalledWith(1, 'test/superface');
      expect(mkdirQuiet).toHaveBeenNthCalledWith(2, 'test/superface/grid');
      expect(mkdirQuiet).toHaveBeenNthCalledWith(3, 'test/superface/types');

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        'test/superface/super.json',
        expect.anything(),
        { force: undefined }
      );

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledWith('test/superface/super.json');
    });
  });

  describe('when generating profiles', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('creates profile', async () => {
      mocked(createProfile).mockResolvedValue(undefined);
      const mockPath = 'test';
      const mockSuperJson = new SuperJson({});
      const mockProfileIds = ['first-profile@1.1.0', 'second-profile@2.1.0'];

      await expect(
        generateSpecifiedProfiles(mockPath, mockSuperJson, mockProfileIds)
      ).resolves.toBeUndefined();

      expect(createProfile).toHaveBeenCalledTimes(2);
      expect(createProfile).toHaveBeenNthCalledWith(
        1,
        'test/superface/grid',
        ProfileId.fromParameters({
          version: ProfileVersion.fromString('1.1.0'),
          name: 'first-profile',
        }),
        [composeUsecaseName('first-profile')],
        mockSuperJson,
        undefined,
        { logCb: undefined }
      );
      expect(createProfile).toHaveBeenNthCalledWith(
        2,
        'test/superface/grid',
        ProfileId.fromParameters({
          version: ProfileVersion.fromString('2.1.0'),
          name: 'second-profile',
        }),
        [composeUsecaseName('second-profile')],
        mockSuperJson,
        undefined,
        { logCb: undefined }
      );
    });

    it('does not create profile if there is a parse error', async () => {
      mocked(createProfile).mockResolvedValue(undefined);
      const mockPath = 'test';
      const mockSuperJson = new SuperJson({});
      const mockProfileIds = ['first-profile-id@r!l'];

      await expect(
        generateSpecifiedProfiles(mockPath, mockSuperJson, mockProfileIds)
      ).rejects.toEqual(
        new CLIError(
          'Invalid profile id: could not parse version: major component is not a valid number'
        )
      );

      expect(createProfile).not.toHaveBeenCalled();
    });
  });
});
