import { CLIError } from '@oclif/errors';
import { err, ok, SDKExecutionError, SuperJson } from '@superfaceai/one-sdk';
import {
  DEFAULT_MAP_VERSION,
  DEFAULT_PROFILE_VERSION,
  MapId,
  MapVersion,
  ProfileId,
  ProfileVersion,
} from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import { check, CheckResult, formatHuman, formatJson } from '../logic/check';
import { detectSuperJson } from '../logic/install';
import { MockStd, mockStd } from '../test/mock-std';
import Check from './check';

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

//Mock check logic
jest.mock('../logic/check', () => ({
  check: jest.fn(),
  formatHuman: jest.fn(),
  formatJson: jest.fn(),
}));

describe('Check CLI command', () => {
  const profileId = 'starwars/character-information';
  const provider = 'swapi';

  const mockResult: CheckResult[] = [
    {
      kind: 'error',
      message: 'first-error',
    },
    {
      kind: 'warn',
      message: 'first-warn',
    },
    {
      kind: 'error',
      message: 'second-error',
    },
    {
      kind: 'warn',
      message: 'second-warn',
    },
  ];
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

  describe('when running checkcommand', () => {
    it('throws when super.json not found', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(
        Check.run(['--profileId', profileId, '--providerName', provider])
      ).rejects.toEqual(new CLIError('Unable to check, super.json not found'));
    });

    it('throws when super.json not loaded correctly', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(err(new SDKExecutionError('test error', [], [])));
      await expect(
        Check.run(['--profileId', profileId, '--providerName', provider])
      ).rejects.toEqual(new CLIError('Unable to load super.json: test error'));
    });

    it('throws error on invalid scan flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        Check.run([
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s test',
        ])
      ).rejects.toEqual(
        new CLIError('Expected an integer but received:  test')
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on scan flag higher than 5', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        Check.run([
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '6',
        ])
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
        Check.run([
          '--profileId',
          'U!0_',
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(
        new CLIError(
          'Invalid profile id: "U!0_" is not a valid lowercase identifier'
        )
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid provider name', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        Check.run([
          '--profileId',
          profileId,
          '--providerName',
          'U!0_',
          '-s',
          '3',
        ])
      ).rejects.toEqual(new CLIError('Invalid provider name: "U!0_"'));
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error when profile Id not found in super.json', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        Check.run([
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(
        new CLIError(`Profile id: "${profileId}" not found in super.json`)
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error when profile provider not found in super.json', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: '',
          },
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        Check.run([
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(
        new CLIError(
          `Provider: "${provider}" not found in profile: "${profileId}" in super.json`
        )
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error when provider not found in super.json', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: '',
            providers: {
              [provider]: {},
            },
          },
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        Check.run([
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).rejects.toEqual(
        new CLIError(`Provider: "${provider}" not found in super.json`)
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    });

    it('formats result to human readable format', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(check).mockResolvedValue(mockResult);
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: '',
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(formatHuman).mockReturnValue('format-human');

      await expect(
        Check.run([
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
        ])
      ).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      const expectedProfileId = ProfileId.fromParameters({
        scope: 'starwars',
        name: 'character-information',
        version: DEFAULT_PROFILE_VERSION,
      });
      expect(check).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId,
        MapId.fromParameters({
          profile: expectedProfileId,
          provider,
          version: DEFAULT_MAP_VERSION,
        }),
        { logCb: expect.anything(), warnCb: expect.anything() }
      );
      expect(stdout.output).toEqual('format-human\n');
      expect(formatHuman).toHaveBeenCalledWith(mockResult);
    });

    it('formats result to human readable format, profile with version, map with variant', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(check).mockResolvedValue(mockResult);
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            version: '1.2.3',
            providers: {
              [provider]: {
                mapVariant: 'test',
              },
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(formatHuman).mockReturnValue('format-human');

      await expect(
        Check.run([
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
          '-q',
        ])
      ).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      const expectedProfileId = ProfileId.fromParameters({
        scope: 'starwars',
        name: 'character-information',
        version: ProfileVersion.fromString('1.2.3'),
      });

      expect(check).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId,
        MapId.fromParameters({
          profile: expectedProfileId,
          provider,
          version: MapVersion.fromString('1.2'),
          variant: 'test',
        }),
        { logCb: undefined, warnCb: undefined }
      );
      expect(stdout.output).toEqual('format-human\n');
      expect(formatHuman).toHaveBeenCalledWith(mockResult);
    });

    it('formats result to human readable format with quiet flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(check).mockResolvedValue(mockResult);
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: '',
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(formatHuman).mockReturnValue('format-human');

      await expect(
        Check.run([
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
          '-q',
        ])
      ).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      const expectedProfileId = ProfileId.fromParameters({
        scope: 'starwars',
        name: 'character-information',
        version: DEFAULT_PROFILE_VERSION,
      });

      expect(check).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId,
        MapId.fromParameters({
          profile: expectedProfileId,
          provider,
          version: DEFAULT_MAP_VERSION,
        }),
        { logCb: undefined, warnCb: undefined }
      );
      expect(stdout.output).toEqual('format-human\n');
      expect(formatHuman).toHaveBeenCalledWith(mockResult);
    });

    it('formats result to json with quiet flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(check).mockResolvedValue(mockResult);
      const mockSuperJson = new SuperJson({
        profiles: {
          [profileId]: {
            file: '',
            providers: {
              [provider]: {},
            },
          },
        },
        providers: {
          [provider]: {},
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(formatJson).mockReturnValue(
        '[{"kind": "error", "message": "test"}]'
      );

      await expect(
        Check.run([
          '--profileId',
          profileId,
          '--providerName',
          provider,
          '-s',
          '3',
          '-q',
          '-j',
        ])
      ).resolves.toBeUndefined();
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
      const expectedProfileId = ProfileId.fromParameters({
        scope: 'starwars',
        name: 'character-information',
        version: DEFAULT_PROFILE_VERSION,
      });

      expect(check).toHaveBeenCalledWith(
        mockSuperJson,
        expectedProfileId,
        MapId.fromParameters({
          profile: expectedProfileId,
          provider,
          version: DEFAULT_MAP_VERSION,
        }),
        { logCb: undefined, warnCb: undefined }
      );
      expect(stdout.output).toContain('[{"kind": "error", "message": "test"}]');
      expect(formatJson).toHaveBeenCalledWith(mockResult);
      expect(formatHuman).not.toHaveBeenCalled();
    });
  });
});
