import { err, ok, SDKExecutionError } from '@superfaceai/one-sdk';
import * as SuperJson from '@superfaceai/one-sdk/dist/schema-tools/superjson/utils';
import { mocked } from 'ts-jest/utils';

import { MockLogger } from '..';
import { createUserError } from '../common/error';
import { ProfileId } from '../common/profile';
import { generate } from '../logic/generate';
import { detectSuperJson } from '../logic/install';
import { CommandInstance } from '../test/utils';
import Generate from './generate';

jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));
jest.mock('../logic/generate', () => ({
  generate: jest.fn(),
}));

describe('Generate CLI command', () => {
  const profileId = 'starwars/character-information';

  let logger: MockLogger;
  let instance: Generate;
  const userError = createUserError(false);

  beforeEach(() => {
    logger = new MockLogger();
    instance = CommandInstance(Generate);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running generate command', () => {
    it('throws when super.json not found', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
          },
        })
      ).rejects.toThrow('Unable to generate, super.json not found');
    });

    it('throws when super.json not loaded correctly', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(err(new SDKExecutionError('test error', [], [])));
      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
          },
        })
      ).rejects.toThrow('Unable to load super.json: test error');
    });

    it('throws error on scan flag higher than 5', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
            scan: 6,
          },
        })
      ).rejects.toThrow(
        '--scan/-s : Number of levels to scan cannot be higher than 5'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid profile id', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: 'U!0_',
            scan: 3,
          },
        })
      ).rejects.toThrow(
        'Invalid profile id: "U!0_" is not a valid lowercase identifier'
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error when profile Id not found in super.json', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
            scan: 3,
          },
        })
      ).rejects.toThrow(`Profile id: "${profileId}" not found in super.json`);
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('generates types for specified local profile', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockPath = 'path/to/profile.supr';
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            file: mockPath,
          },
        },
        providers: {},
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
            scan: 3,
          },
        })
      ).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(generate).toHaveBeenCalledWith(
        {
          profiles: [
            {
              id: ProfileId.fromId(profileId, { userError }),
              version: undefined,
            },
          ],
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
        },
        expect.anything()
      );
      expect(logger.stdout).toContainEqual(['generatedSuccessfully', []]);
    });

    it('generates types for specified remote profile', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const version = '1.0.8';
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version,
          },
        },
        providers: {},
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId,
            scan: 3,
          },
        })
      ).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(generate).toHaveBeenCalledWith(
        {
          profiles: [
            { id: ProfileId.fromId(profileId, { userError }), version },
          ],
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
        },
        expect.anything()
      );
      expect(logger.stdout).toContainEqual(['generatedSuccessfully', []]);
    });

    it('generates types for super json with remote and local profiles', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const version = '1.0.8';
      const mockPath = 'path/to/profile.supr';
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version,
          },
          other: {
            file: mockPath,
          },
        },
        providers: {},
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            scan: 3,
          },
        })
      ).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(generate).toHaveBeenCalledWith(
        {
          profiles: [
            { id: ProfileId.fromId(profileId, { userError }), version },
            { id: ProfileId.fromId('other', { userError }) },
          ],
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
        },
        expect.anything()
      );
      expect(logger.stdout).toContainEqual(['generatedSuccessfully', []]);
    });

    it('generates types for super json with remote and local profiles and quiet flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const version = '1.0.8';
      const mockPath = 'path/to/profile.supr';
      const mockSuperJson = {
        profiles: {
          [profileId]: {
            version,
          },
          other: {
            file: mockPath,
          },
        },
        providers: {},
      };
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            quiet: true,
            scan: 3,
          },
        })
      ).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(generate).toHaveBeenCalledWith(
        {
          profiles: [
            { id: ProfileId.fromId(profileId, { userError }), version },
            {
              id: ProfileId.fromId('other', { userError }),
              version: undefined,
            },
          ],
          superJson: mockSuperJson,
          superJsonPath: 'super.json',
        },
        expect.anything()
      );
      expect(logger.stdout).toContainEqual(['generatedSuccessfully', []]);
    });
  });
});
