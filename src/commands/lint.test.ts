import { CLIError } from '@oclif/errors';
import { err, ok, SuperJson } from '@superfaceai/one-sdk';
import { SDKExecutionError } from '@superfaceai/one-sdk/dist/internal/errors';
import { mocked } from 'ts-jest/utils';

import { MockLogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { detectSuperJson } from '../logic/install';
import { lint } from '../logic/lint';
import { CommandInstance } from '../test/utils';
import Lint from './lint';

//Mock output stream
jest.mock('../common/output-stream');

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

//Mock lint logic
jest.mock('../logic/lint', () => ({
  ...jest.requireActual<Record<string, unknown>>('../logic/lint'),
  lint: jest.fn(),
}));

describe('lint CLI command', () => {
  let logger: MockLogger;
  let instance: Lint;
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

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('lint CLI command', () => {
    it('throws when super.json not found', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(
        instance.execute({
          logger,
          flags: defaultFlags,
        })
      ).rejects.toEqual(
        new CLIError('❌ Unable to lint, super.json not found')
      );
    });

    it('throws when super.json not loaded correctly', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(err(new SDKExecutionError('test error', [], [])));
      await expect(
        instance.execute({
          logger,
          flags: defaultFlags,
        })
      ).rejects.toEqual(
        new CLIError('❌ Unable to load super.json: test error')
      );
    });

    it('throws error on scan flag higher than 5', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        instance.execute({
          logger,
          flags: { ...defaultFlags, scan: 6 },
        })
      ).rejects.toEqual(
        new CLIError(
          '❌ --scan/-s : Number of levels to scan cannot be higher than 5'
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
        instance.execute({
          logger,
          flags: {
            ...defaultFlags,
            profileId: 'U!0_',
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toEqual(
        new CLIError(
          '❌ Invalid profile id: "U!0_" is not a valid lowercase identifier'
        )
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
          flags: {
            ...defaultFlags,
            profileId,
            providerName: 'U!0_',
            scan: 3,
          },
        })
      ).rejects.toEqual(new CLIError('❌ Invalid provider name: "U!0_"'));
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
          flags: {
            ...defaultFlags,
            profileId,
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toEqual(
        new CLIError(
          `❌ Unable to lint, profile: "${profileId}" not found in super.json`
        )
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
          flags: {
            ...defaultFlags,
            profileId,
            providerName: provider,
            scan: 3,
          },
        })
      ).rejects.toEqual(
        new CLIError(
          `❌ Unable to lint, provider: "${provider}" not found in profile: "${profileId}" in super.json`
        )
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
        mocked(lint).mockResolvedValue([[0, 0]]);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            flags: {
              ...defaultFlags,
              scan: 4,
            },
          })
        ).resolves.toBeUndefined();

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          {
            superJson: mockSuperJson,
            profiles: [
              {
                id: ProfileId.fromId(mockLocalProfile),
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
            writer: expect.anything(),
            reportFn: expect.anything(),
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledWith('\nDetected 0 problems\n');

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
        mocked(lint).mockResolvedValue([[0, 0]]);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            flags: {
              ...defaultFlags,
              profileId: mockLocalProfile,
              scan: 4,
            },
          })
        ).resolves.toBeUndefined();

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          {
            superJson: mockSuperJson,
            profiles: [
              {
                id: ProfileId.fromId(mockLocalProfile),
                maps: [
                  {
                    provider: mockLocalProvider,
                  },
                  { provider: mockProvider, variant: 'test' },
                ],
              },
            ],
            writer: expect.anything(),
            reportFn: expect.anything(),
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledWith('\nDetected 0 problems\n');

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
        mocked(lint).mockResolvedValue([[0, 0]]);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            flags: {
              ...defaultFlags,
              profileId: mockProfile,
              scan: 4,
            },
          })
        ).resolves.toBeUndefined();

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          {
            superJson: mockSuperJson,
            profiles: [
              {
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    provider: mockLocalProvider,
                  },
                  { provider: mockProvider, variant: 'test' },
                ],
                version,
              },
            ],
            writer: expect.anything(),
            reportFn: expect.anything(),
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledWith('\nDetected 0 problems\n');

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
        mocked(lint).mockResolvedValue([[0, 0]]);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
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
          {
            superJson: mockSuperJson,
            profiles: [
              {
                id: ProfileId.fromId(mockLocalProfile),
                maps: [
                  {
                    provider: mockLocalProvider,
                  },
                ],
              },
            ],
            writer: expect.anything(),
            reportFn: expect.anything(),
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledWith('\nDetected 0 problems\n');

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
        mocked(lint).mockResolvedValue([[0, 0]]);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
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
          {
            superJson: mockSuperJson,
            profiles: [
              {
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    provider: mockLocalProvider,
                  },
                ],
                version,
              },
            ],
            writer: expect.anything(),
            reportFn: expect.anything(),
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledWith('\nDetected 0 problems\n');

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
        mocked(lint).mockResolvedValue([[0, 0]]);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
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
          {
            superJson: mockSuperJson,
            profiles: [
              {
                id: ProfileId.fromId(mockProfile),
                maps: [{ provider: mockProvider, variant: mapVariant }],
                version,
              },
            ],
            writer: expect.anything(),
            reportFn: expect.anything(),
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledWith('\nDetected 0 problems\n');

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
        mocked(lint).mockResolvedValue([[0, 1]]);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
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
          {
            superJson: mockSuperJson,
            profiles: [
              {
                id: ProfileId.fromId(mockProfile),
                maps: [{ provider: mockProvider, variant: mapVariant }],
                version,
              },
            ],
            writer: expect.anything(),
            reportFn: expect.anything(),
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledWith('\nDetected 1 problem\n');

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
        mocked(lint).mockResolvedValue([[1, 0]]);
        const writeSpy = jest
          .spyOn(OutputStream.prototype, 'write')
          .mockResolvedValue(undefined);
        const cleanupSpy = jest
          .spyOn(OutputStream.prototype, 'cleanup')
          .mockResolvedValue(undefined);

        await expect(
          instance.execute({
            logger,
            flags: {
              ...defaultFlags,
              profileId: mockProfile,
              providerName: mockProvider,
              scan: 4,
            },
          })
        ).rejects.toEqual(new CLIError('❌ Errors were found'));

        expect(lint).toHaveBeenCalledTimes(1);
        expect(lint).toHaveBeenCalledWith(
          {
            superJson: mockSuperJson,
            profiles: [
              {
                id: ProfileId.fromId(mockProfile),
                maps: [{ provider: mockProvider, variant: mapVariant }],
                version,
              },
            ],
            writer: expect.anything(),
            reportFn: expect.anything(),
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy).toHaveBeenCalledWith('\nDetected 1 problem\n');

        expect(cleanupSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
