import { CLIError } from '@oclif/errors';
import { ok, SuperJson } from '@superfaceai/one-sdk';
import { parseProfileId } from '@superfaceai/parser';
import { basename } from 'path';
import { mocked } from 'ts-jest/utils';

import { composeUsecaseName } from '../common/document';
import { mkdir, mkdirQuiet } from '../common/io';
import { OutputStream } from '../common/output-stream';
import * as initTemplate from '../templates/init';
import { createProfile } from './create';
import { generateSpecifiedProfiles, initSuperface } from './init';

//Mock io
jest.mock('../common/io', () => ({
  mkdir: jest.fn(),
  mkdirQuiet: jest.fn(),
}));

//Mock parser
jest.mock('@superfaceai/parser', () => ({
  parseProfileId: jest.fn(),
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

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(2);
      expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
        1,
        'test/README.md',
        initTemplate.readme(basename('test')),
        { force: undefined }
      );
      expect(writeIfAbsentSpy).toHaveBeenNthCalledWith(
        2,
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
        generateSpecifiedProfiles(mockPath, mockSuperJson, mockProfileIds)
      ).resolves.toBeUndefined();

      expect(parseProfileId).toHaveBeenCalledTimes(2);
      expect(parseProfileId).toHaveBeenNthCalledWith(1, 'first-profile-id');
      expect(parseProfileId).toHaveBeenNthCalledWith(2, 'second-profile-id');

      expect(createProfile).toHaveBeenCalledTimes(2);
      expect(createProfile).toHaveBeenNthCalledWith(
        1,
        'test/superface/grid',
        mockSuperJson,
        { scope: undefined, name: 'first-test-name', version: { major: 1 } },
        [composeUsecaseName('first-test-name')],
        { logCb: undefined }
      );
      expect(createProfile).toHaveBeenNthCalledWith(
        2,
        'test/superface/grid',
        mockSuperJson,
        { scope: undefined, name: 'second-test-name', version: { major: 2 } },
        [composeUsecaseName('second-test-name')],
        { logCb: undefined }
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
        generateSpecifiedProfiles(mockPath, mockSuperJson, mockProfileIds)
      ).rejects.toEqual(new CLIError('Wrong profile Id'));

      expect(parseProfileId).toHaveBeenCalledTimes(1);
      expect(parseProfileId).toHaveBeenCalledWith('first-profile-id');

      expect(createProfile).not.toHaveBeenCalled();
    });
  });
});
