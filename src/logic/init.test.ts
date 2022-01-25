import { ok, SuperJson } from '@superfaceai/one-sdk';
import { parseProfileId } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import { MockLogger } from '../common';
import { composeUsecaseName } from '../common/document';
import { createUserError } from '../common/error';
import { mkdir, mkdirQuiet } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { createProfile } from './create';
import { generateSpecifiedProfiles, initSuperface } from './init';

jest.mock('../common/io', () => ({
  mkdir: jest.fn(),
  mkdirQuiet: jest.fn(),
}));

jest.mock('@superfaceai/parser', () => ({
  parseProfileId: jest.fn(),
}));

jest.mock('./create', () => ({
  createProfile: jest.fn(),
}));

describe('Init logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);

  describe('when initialing superface', () => {
    beforeEach(() => {
      logger = new MockLogger();
    });

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

      await expect(
        initSuperface({ appPath: mockAppPath }, { logger })
      ).resolves.not.toBeUndefined();

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
      mocked(parseProfileId)
        .mockReturnValueOnce({
          kind: 'parsed',
          value: {
            name: 'first-test-name',
            version: { major: 1 },
          },
        })
        .mockReturnValueOnce({
          kind: 'parsed',
          value: {
            name: 'second-test-name',
            version: { major: 2 },
          },
        });
      mocked(createProfile).mockResolvedValue(undefined);
      const mockPath = 'test';
      const mockSuperJson = new SuperJson({});
      const mockProfileIds = ['first-profile-id', 'second-profile-id'];

      await expect(
        generateSpecifiedProfiles(
          {
            path: mockPath,
            superJson: mockSuperJson,
            profileIds: mockProfileIds,
          },
          { logger, userError }
        )
      ).resolves.toBeUndefined();

      expect(parseProfileId).toHaveBeenCalledTimes(2);
      expect(parseProfileId).toHaveBeenNthCalledWith(1, 'first-profile-id');
      expect(parseProfileId).toHaveBeenNthCalledWith(2, 'second-profile-id');

      expect(createProfile).toHaveBeenCalledTimes(2);
      expect(createProfile).toHaveBeenNthCalledWith(
        1,
        {
          basePath: 'test/superface/grid',
          profile: ProfileId.fromScopeName(undefined, 'first-test-name'),
          version: { major: 1 },
          usecaseNames: [composeUsecaseName('first-test-name')],
          superJson: mockSuperJson,
        },
        expect.anything()
      );
      expect(createProfile).toHaveBeenNthCalledWith(
        2,
        {
          basePath: 'test/superface/grid',
          profile: ProfileId.fromScopeName(undefined, 'second-test-name'),
          version: { major: 2 },
          usecaseNames: [composeUsecaseName('second-test-name')],
          superJson: mockSuperJson,
        },
        expect.anything()
      );
    });

    it('does not create profile if there is a parse error', async () => {
      mocked(parseProfileId).mockReturnValue({
        kind: 'error',
        message: 'mockMessage',
      });
      mocked(createProfile).mockResolvedValue(undefined);
      const mockPath = 'test';
      const mockSuperJson = new SuperJson({});
      const mockProfileIds = ['first-profile-id'];

      await expect(
        generateSpecifiedProfiles(
          {
            path: mockPath,
            superJson: mockSuperJson,
            profileIds: mockProfileIds,
          },
          { logger, userError }
        )
      ).rejects.toThrow('Wrong profile Id');

      expect(parseProfileId).toHaveBeenCalledTimes(1);
      expect(parseProfileId).toHaveBeenCalledWith('first-profile-id');

      expect(createProfile).not.toHaveBeenCalled();
    });
  });
});
