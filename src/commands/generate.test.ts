import { CLIError } from '@oclif/errors';
import { err, ok, SuperJson } from '@superfaceai/one-sdk';
import { SDKExecutionError } from '@superfaceai/one-sdk/dist/internal/errors';
import { ProfileId } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import { generate } from '../logic/generate';
import { detectSuperJson } from '../logic/install';
import { MockStd, mockStd } from '../test/mock-std';
import Generate from './generate';

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

//Mock generate logic
jest.mock('../logic/generate', () => ({
  generate: jest.fn(),
}));

describe('Generate CLI command', () => {
  const profileId = 'starwars/character-information';

  let stderr: MockStd;
  let stdout: MockStd;

  beforeEach(() => {
    stdout = mockStd();
    stderr = mockStd();

    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
    jest
      .spyOn(process['stderr'], 'write')
      .mockImplementation(stderr.implementation);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running generate command', () => {
    it('throws when super.json not found', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(Generate.run(['--profileId', profileId])).rejects.toEqual(
        new CLIError('Unable to generate, super.json not found')
      );
    });

    it('throws when super.json not loaded correctly', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(err(new SDKExecutionError('test error', [], [])));
      await expect(Generate.run(['--profileId', profileId])).rejects.toEqual(
        new CLIError('Unable to load super.json: test error')
      );
    });

    it('throws error on invalid scan flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(Generate.run(['-s test'])).rejects.toEqual(
        new CLIError('Expected an integer but received:  test')
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on scan flag higher than 5', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        Generate.run(['--profileId', profileId, '-s', '6'])
      ).rejects.toEqual(
        new CLIError(
          '--scan/-s : Number of levels to scan cannot be higher than 5'
        )
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid profile id', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        Generate.run(['--profileId', 'U!0_', '-s', '3'])
      ).rejects.toEqual(
        new CLIError(
          'Invalid profile id: "U!0_" is not a valid lowercase identifier'
        )
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error when profile Id not found in super.json', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        Generate.run(['--profileId', profileId, '-s', '3'])
      ).rejects.toEqual(
        new CLIError(`Profile id: "${profileId}" not found in super.json`)
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('generates types for specified local profile', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockPath = 'path/to/profile.supr';
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: mockPath,
          },
        },
        providers: {},
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        Generate.run(['--profileId', profileId, '-s', '3'])
      ).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(generate).toHaveBeenCalledWith(
        [ProfileId.fromId(profileId, '1.0.0')],
        mockSuperJson,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
      expect(stdout.output).toEqual('🆗 types generated successfully.\n');
    });

    it('generates types for specified remote profile', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const version = '1.0.8';
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version,
          },
        },
        providers: {},
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        Generate.run(['--profileId', profileId, '-s', '3'])
      ).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(generate).toHaveBeenCalledWith(
        [ProfileId.fromId(profileId, version)],
        mockSuperJson,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
      expect(stdout.output).toEqual('🆗 types generated successfully.\n');
    });

    it('generates types for super json with remote and local profiles', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const version = '1.0.8';
      const mockPath = 'path/to/profile.supr';
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version,
          },
          other: {
            file: mockPath,
          },
        },
        providers: {},
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(Generate.run(['-s', '3'])).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(generate).toHaveBeenCalledWith(
        [
          ProfileId.fromId(profileId, version),
          ProfileId.fromId('other', '1.0.0'),
        ],
        mockSuperJson,
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
      expect(stdout.output).toEqual(`🆗 types generated successfully.\n`);
    });

    it('generates types for super json with remote and local profiles and quiet flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const version = '1.0.8';
      const mockPath = 'path/to/profile.supr';
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version,
          },
          other: {
            file: mockPath,
          },
        },
        providers: {},
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(Generate.run(['-q', '-s', '3'])).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      expect(generate).toHaveBeenCalledWith(
        [
          ProfileId.fromId(profileId, version),
          ProfileId.fromId('other', '1.0.0'),
        ],
        mockSuperJson,
        { logCb: undefined, warnCb: undefined }
      );
      expect(stdout.output).toEqual('');
    });
  });
});
