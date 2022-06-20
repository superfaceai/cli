import { err, ok, SuperJson } from '@superfaceai/one-sdk';
import { SDKExecutionError } from '@superfaceai/one-sdk/dist/internal/errors';
import { mocked } from 'ts-jest/utils';

import { createUserError } from '../common/error';
import { MockLogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { detectSuperJson } from '../logic/install';
import {
  formatHuman,
  formatJson,
  formatSummary,
  lint,
  LintResult,
} from '../logic/lint';
import { CommandInstance } from '../test/utils';
import Lint from './lint';

jest.mock('../common/output-stream');
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));
jest.mock('../logic/lint', () => ({
  ...jest.requireActual<Record<string, unknown>>('../logic/lint'),
  lint: jest.fn(),
}));

describe('lint CLI command', () => {
  let logger: MockLogger;
  let instance: Lint;
  const userError = createUserError(false);
  const profileId = 'starwars/character-information';
  const provider = 'swapi';
  const defaultFlags = {
    output: '-',
    outputFormat: 'long' as 'long' | 'json' | 'short',
  };

  beforeEach(() => {
    logger = new MockLogger();
    instance = CommandInstance(Lint);
  });

  const mockResultWithErrs: LintResult = {
    reports: [
      {
        errors: [
          {
            context: {
              actual: 'different-test-profile',
              expected: 'test-profile',
              path: {
                kind: 'nodeKind',
                location: {
                  start: {
                    line: 1,
                    column: 1,
                    charIndex: 0,
                  },
                  end: {
                    line: 1,
                    column: 1,
                    charIndex: 0,
                  },
                },
              },
            },
            kind: 'wrongProfileName',
          },
        ],
        kind: 'compatibility',
        path: 'swapi path',
        profile: 'mockProfilePath',
        warnings: [],
      },
      {
        errors: [],
        kind: 'compatibility',
        path: 'starwars path',
        profile: 'mockProfilePath',
        warnings: [],
      },
    ],
    total: { errors: 1, warnings: 0 },
  };

  const mockResult: LintResult = {
    reports: [
      {
        errors: [],
        kind: 'compatibility',
        path: 'swapi path',
        profile: 'mockProfilePath',
        warnings: [],
      },
      {
        errors: [],
        kind: 'compatibility',
        path: 'starwars path',
        profile: 'mockProfilePath',
        warnings: [],
      },
    ],
    total: { errors: 0, warnings: 0 },
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('lint CLI command', () => {
    it('throws when super.json not found', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(
        instance.execute({
          logger,
          userError,
          flags: defaultFlags,
        })
      ).rejects.toThrow('Unable to lint, super.json not found');
    });

    it('throws when super.json not loaded correctly', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(err(new SDKExecutionError('test error', [], [])));
      await expect(
        instance.execute({
          logger,
          userError,
          flags: defaultFlags,
        })
      ).rejects.toThrow('Unable to load super.json: test error');
    });

    it('throws error on scan flag higher than 5', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        instance.execute({
          logger,
          userError,
          flags: { ...defaultFlags, scan: 6 },
        })
      ).rejects.toThrow(
        '--scan/-s : Number of levels to scan cannot be higher than 5'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid profile id', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            ...defaultFlags,
            profileId: 'U!0_',
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        'Invalid profile id: "U!0_" is not a valid lowercase identifier'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on missing profile id', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        Lint.run(['--providerName', 'test', '-s', '3'])
      ).rejects.toThrow(
        '--profileId must be specified when using --providerName'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid provider name', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            ...defaultFlags,
            profileId,
            providerName: 'U!0_',
            scan: 3,
          },
        })
      ).rejects.toThrow('Invalid provider name: "U!0_"');
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on missing profile id in super.json', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            ...defaultFlags,
            profileId,
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Unable to lint, profile: "${profileId}" not found in super.json`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error on missing provider id in super.json', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest.spyOn(SuperJson, 'load').mockResolvedValue(
        ok(
          new SuperJson({
            profiles: {
              [profileId]: {
                version: '1.0.0',
                defaults: {},
              },
            },
            providers: {},
          })
        )
      );

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            ...defaultFlags,
            profileId,
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Unable to lint, provider: "${provider}" not found in profile: "${profileId}" in super.json`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    describe('linting whole super json', () => {
      it('lints local profiles and maps file from super.json and scan flag', async () => {
        const mockLocalProfile = 'starwars/character-information';
        const mockProfile = 'startrek/character-information';
        const mockLocalProvider = 'swapi';
        const secondMockLocalProvider = 'starwarsapi';
        const mockProvider = 'startrek';
        const mockSuperJson = new SuperJson({
          profiles: {
            [mockLocalProfile]: {
              file: `../${mockLocalProfile}.supr`,
              defaults: {},
              providers: {
                [mockLocalProvider]: {
                  file: `../${mockLocalProfile}.${mockLocalProvider}.suma`,
                },
                [secondMockLocalProvider]: {
                  file: `../${mockLocalProfile}.${secondMockLocalProvider}.suma`,
                },
              },
            },
            [mockProfile]: {
              version: '1.0.0',
              defaults: {},
              providers: {
                [mockProvider]: {
                  mapVariant: 'test',
                },
              },
            },
          },
          providers: {
            [mockLocalProvider]: {
              file: '../swapi.provider.json',
              security: [],
            },
            [mockProvider]: {
              security: [],
            },
          },
        });
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(lint).mockResolvedValue(mockResult);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {
              ...defaultFlags,
              scan: 4,
            },
          })
        ).resolves.toBeUndefined();

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          mockSuperJson,
          [
            {
              id: ProfileId.fromId(mockLocalProfile, { userError }),
              maps: [
                {
                  provider: mockLocalProvider,
                },
                {
                  provider: secondMockLocalProvider,
                },
              ],
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[0],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[1],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatSummary({
            fileCount: 2,
            errorCount: 0,
            warningCount: 0,
            quiet: false,
            color: true,
          })
        );

        expect(cleanupSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('linting single profile and its maps', () => {
      it('lints local profile and its maps', async () => {
        const mockLocalProfile = 'starwars/character-information';
        const mockLocalProvider = 'swapi';
        const mockProvider = 'starwarsapi';
        const mockSuperJson = new SuperJson({
          profiles: {
            [mockLocalProfile]: {
              file: `../${mockLocalProfile}.supr`,
              defaults: {},
              providers: {
                [mockLocalProvider]: {
                  file: `../${mockLocalProfile}.${mockLocalProvider}.suma`,
                },
                [mockProvider]: {
                  mapVariant: 'test',
                },
              },
            },
          },
          providers: {
            [mockLocalProvider]: {
              file: '../swapi.provider.json',
              security: [],
            },
            [mockProvider]: {
              security: [],
            },
          },
        });
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(lint).mockResolvedValue(mockResult);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {
              ...defaultFlags,
              profileId: mockLocalProfile,
              scan: 4,
            },
          })
        ).resolves.toBeUndefined();

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          mockSuperJson,
          [
            {
              id: ProfileId.fromId(mockLocalProfile, { userError }),
              maps: [
                {
                  provider: mockLocalProvider,
                },
                { provider: mockProvider, variant: 'test' },
              ],
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[0],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[1],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatSummary({
            fileCount: 2,
            errorCount: 0,
            warningCount: 0,
            quiet: false,
            color: true,
          })
        );

        expect(cleanupSpy).toHaveBeenCalledTimes(1);
      });

      it('lints remote profile and its maps', async () => {
        const mockProfile = 'starwars/character-information';
        const mockLocalProvider = 'swapi';
        const mockProvider = 'starwarsapi';
        const version = '1.0.2';
        const mockSuperJson = new SuperJson({
          profiles: {
            [mockProfile]: {
              version,
              defaults: {},
              providers: {
                [mockLocalProvider]: {
                  file: `../${mockProfile}.${mockLocalProvider}.suma`,
                },
                [mockProvider]: {
                  mapVariant: 'test',
                },
              },
            },
          },
          providers: {
            [mockLocalProvider]: {
              file: '../swapi.provider.json',
              security: [],
            },
            [mockProvider]: {
              security: [],
            },
          },
        });
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(lint).mockResolvedValue(mockResult);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {
              ...defaultFlags,
              profileId: mockProfile,
              scan: 4,
            },
          })
        ).resolves.toBeUndefined();

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          mockSuperJson,
          [
            {
              id: ProfileId.fromId(mockProfile, { userError }),
              maps: [
                {
                  provider: mockLocalProvider,
                },
                { provider: mockProvider, variant: 'test' },
              ],
              version,
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[0],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[1],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatSummary({
            fileCount: 2,
            errorCount: 0,
            warningCount: 0,
            quiet: false,
            color: true,
          })
        );

        expect(cleanupSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('linting single profile and single map', () => {
      it('lints local profile and local map', async () => {
        const mockLocalProfile = 'starwars/character-information';
        const mockLocalProvider = 'swapi';
        const mockSuperJson = new SuperJson({
          profiles: {
            [mockLocalProfile]: {
              file: `../${mockLocalProfile}.supr`,
              defaults: {},
              providers: {
                [mockLocalProvider]: {
                  file: `../${mockLocalProfile}.${mockLocalProvider}.suma`,
                },
              },
            },
          },
          providers: {
            [mockLocalProvider]: {
              file: '../swapi.provider.json',
              security: [],
            },
          },
        });
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(lint).mockResolvedValue(mockResult);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {
              ...defaultFlags,
              profileId: mockLocalProfile,
              providerName: mockLocalProvider,
              scan: 4,
            },
          })
        ).resolves.toBeUndefined();

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          mockSuperJson,
          [
            {
              id: ProfileId.fromId(mockLocalProfile, { userError }),
              maps: [
                {
                  provider: mockLocalProvider,
                },
              ],
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[0],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[1],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatSummary({
            fileCount: 2,
            errorCount: 0,
            warningCount: 0,
            quiet: false,
            color: true,
          })
        );

        expect(cleanupSpy).toHaveBeenCalledTimes(1);
      });

      it('lints remote profile and local map', async () => {
        const mockProfile = 'starwars/character-information';
        const mockLocalProvider = 'swapi';
        const version = '1.0.2';
        const mockSuperJson = new SuperJson({
          profiles: {
            [mockProfile]: {
              version,
              defaults: {},
              providers: {
                [mockLocalProvider]: {
                  file: `../${mockProfile}.${mockLocalProvider}.suma`,
                },
              },
            },
          },
          providers: {
            [mockLocalProvider]: {
              file: '../swapi.provider.json',
              security: [],
            },
          },
        });
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(lint).mockResolvedValue(mockResult);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {
              ...defaultFlags,
              profileId: mockProfile,
              providerName: mockLocalProvider,
              scan: 4,
            },
          })
        ).resolves.toBeUndefined();

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          mockSuperJson,
          [
            {
              id: ProfileId.fromId(mockProfile, { userError }),
              maps: [
                {
                  provider: mockLocalProvider,
                },
              ],
              version,
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[0],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[1],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatSummary({
            fileCount: 2,
            errorCount: 0,
            warningCount: 0,
            quiet: false,
            color: true,
          })
        );

        expect(cleanupSpy).toHaveBeenCalledTimes(1);
      });

      it('lints remote profile and remote map, with quit flag', async () => {
        const mockProfile = 'starwars/character-information';
        const mockProvider = 'swapi';
        const version = '1.0.2';
        const mapVariant = 'test';
        const mockSuperJson = new SuperJson({
          profiles: {
            [mockProfile]: {
              version,
              defaults: {},
              providers: {
                [mockProvider]: {
                  mapVariant,
                },
              },
            },
          },
          providers: {
            [mockProvider]: {
              file: '../swapi.provider.json',
              security: [],
            },
          },
        });
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(lint).mockResolvedValue(mockResult);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {
              ...defaultFlags,
              profileId: mockProfile,
              providerName: mockProvider,
              scan: 4,
            },
          })
        ).resolves.toBeUndefined();

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          mockSuperJson,
          [
            {
              id: ProfileId.fromId(mockProfile, { userError }),
              maps: [{ provider: mockProvider, variant: mapVariant }],
              version,
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[0],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[1],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatSummary({
            fileCount: 2,
            errorCount: 0,
            warningCount: 0,
            quiet: false,
            color: true,
          })
        );

        expect(cleanupSpy).toHaveBeenCalledTimes(1);
      });

      it('lints remote profile and remote map, with json format', async () => {
        const mockProfile = 'starwars/character-information';
        const mockProvider = 'swapi';
        const version = '1.0.2';
        const mapVariant = 'test';
        const mockSuperJson = new SuperJson({
          profiles: {
            [mockProfile]: {
              version,
              defaults: {},
              providers: {
                [mockProvider]: {
                  mapVariant,
                },
              },
            },
          },
          providers: {
            [mockProvider]: {
              file: '../swapi.provider.json',
              security: [],
            },
          },
        });
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(lint).mockResolvedValue(mockResult);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          Lint.run([
            '--profileId',
            mockProfile,
            '--providerName',
            mockProvider,
            '-s',
            '4',
            '-f',
            'json',
          ])
        ).resolves.toBeUndefined();

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          mockSuperJson,
          [
            {
              id: ProfileId.fromId(mockProfile, { userError }),
              maps: [{ provider: mockProvider, variant: mapVariant }],
              version,
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledWith(formatJson(mockResult));

        expect(cleanupSpy).toHaveBeenCalledTimes(1);
      });

      it('does not throw on warning', async () => {
        const mockProfile = 'starwars/character-information';
        const mockProvider = 'swapi';
        const version = '1.0.2';
        const mapVariant = 'test';
        const mockSuperJson = new SuperJson({
          profiles: {
            [mockProfile]: {
              version,
              defaults: {},
              providers: {
                [mockProvider]: {
                  mapVariant,
                },
              },
            },
          },
          providers: {
            [mockProvider]: {
              file: '../swapi.provider.json',
              security: [],
            },
          },
        });
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(lint).mockResolvedValue(mockResult);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {
              ...defaultFlags,
              profileId: mockProfile,
              providerName: mockProvider,
              scan: 4,
            },
          })
        ).resolves.toBeUndefined();

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          mockSuperJson,
          [
            {
              id: ProfileId.fromId(mockProfile, { userError }),
              maps: [{ provider: mockProvider, variant: mapVariant }],
              version,
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[0],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResult.reports[1],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatSummary({
            fileCount: 2,
            errorCount: 0,
            warningCount: 0,
            quiet: false,
            color: true,
          })
        );

        expect(cleanupSpy).toHaveBeenCalledTimes(1);
      });

      it('throws on error', async () => {
        const mockProfile = 'starwars/character-information';
        const mockProvider = 'swapi';
        const version = '1.0.2';
        const mapVariant = 'test';
        const mockSuperJson = new SuperJson({
          profiles: {
            [mockProfile]: {
              version,
              defaults: {},
              providers: {
                [mockProvider]: {
                  mapVariant,
                },
              },
            },
          },
          providers: {
            [mockProvider]: {
              file: '../swapi.provider.json',
              security: [],
            },
          },
        });
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(lint).mockResolvedValue(mockResultWithErrs);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {
              ...defaultFlags,
              profileId: mockProfile,
              providerName: mockProvider,
              scan: 4,
            },
          })
        ).rejects.toThrow('Errors were found');

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          mockSuperJson,
          [
            {
              id: ProfileId.fromId(mockProfile, { userError }),
              maps: [{ provider: mockProvider, variant: mapVariant }],
              version,
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(4);
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResultWithErrs.reports[0],
            quiet: false,
            emoji: true,
            color: true,
            short: false,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatHuman({
            report: mockResultWithErrs.reports[1],
            quiet: false,
            emoji: true,
            color: true,
            short: true,
          })
        );
        expect(writeSpy).toHaveBeenCalledWith(
          formatSummary({
            fileCount: 2,
            errorCount: 1,
            warningCount: 0,
            quiet: false,
            color: true,
          })
        );

        expect(cleanupSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
