import { CLIError } from '@oclif/errors';
import { err, ok, SuperJson } from '@superfaceai/one-sdk';
import { SDKExecutionError } from '@superfaceai/one-sdk/dist/internal/errors';
import { mocked } from 'ts-jest/utils';

import { MockLogger } from '../common';
import { ProfileId } from '../common/profile';
import { compile } from '../logic/compile';
import { detectSuperJson } from '../logic/install';
import { CommandInstance } from '../test/utils';
import Compile from './compile';

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

//Mock compile logic
jest.mock('../logic/compile', () => ({
  compile: jest.fn(),
}));

describe('Compile CLI command', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running compile command', () => {
    let instance: Compile;
    let logger: MockLogger;
    const mockProfile = 'starwars/character-information';
    const secondMockProfile = 'startrek/character-information';
    const mockProvider = 'swapi';
    const secondMockProvider = 'starwarsapi';
    const thirdMockProvider = 'startrek';
    const mockSuperJson = new SuperJson({
      profiles: {
        [mockProfile]: {
          file: `../${mockProfile}.supr`,
          defaults: {},
          providers: {
            [mockProvider]: {
              file: `../${mockProfile}.${mockProvider}.suma`,
            },
            [secondMockProvider]: {
              file: `../${mockProfile}.${secondMockProvider}.suma`,
            },
          },
        },
        [secondMockProfile]: {
          file: `../${secondMockProfile}.supr`,
          defaults: {},
          providers: {
            [thirdMockProvider]: {
              file: `../${secondMockProfile}.${thirdMockProvider}.suma`,
            },
          },
        },
        'other/profile': {
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
        [mockProvider]: {
          file: '../swapi.provider.json',
          security: [],
        },
        [secondMockProvider]: {
          file: '../starwarsapi.provider.json',
          security: [],
        },
        [thirdMockProvider]: {
          file: '../startrek.provider.json',
          security: [],
        },
      },
    });

    beforeEach(() => {
      instance = CommandInstance(Compile);
      logger = new MockLogger();
    });

    it('throws when super.json not found', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(instance.execute({ logger, flags: {} })).rejects.toEqual(
        new CLIError('❌ Unable to compile, super.json not found')
      );
    });

    it('throws when super.json not loaded correctly', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(err(new SDKExecutionError('test error', [], [])));
      await expect(instance.execute({ logger, flags: {} })).rejects.toEqual(
        new CLIError('❌ Unable to load super.json: test error')
      );
    });

    it('throws error on scan flag higher than 5', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        instance.execute({ logger, flags: { scan: 7 } })
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
            profileId: 'U!0_',
            providerName: mockProvider,
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
            profileId: mockProfile,
            providerName: 'U!0_',
            scan: 3,
          },
        })
      ).rejects.toEqual(new CLIError('❌ Invalid provider name: "U!0_"'));
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error when provider name is specified but profile id is not', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(new SuperJson()));

      await expect(
        instance.execute({
          logger,
          flags: { providerName: mockProvider, scan: 3 },
        })
      ).rejects.toEqual(
        new CLIError(
          '❌ --profileId must be specified when using --providerName'
        )
      );
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
            profileId: mockProfile,
            providerName: mockProvider,
            scan: 3,
          },
        })
      ).rejects.toEqual(
        new CLIError(
          `❌ Unable to compile, profile: "${mockProfile}" not found in super.json`
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
              [mockProfile]: {
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
            profileId: mockProfile,
            providerName: mockProvider,
            scan: 3,
          },
        })
      ).rejects.toEqual(
        new CLIError(
          `❌ Unable to compile, provider: "${mockProvider}" not found in profile: "${mockProfile}" in super.json`
        )
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    describe('compiling whole super json', () => {
      it('compiles all local profiles and maps file from super.json and scan flag', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({ logger, flags: { scan: 4 } })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          {
            profiles: [
              {
                path: mockSuperJson.resolvePath(`../${mockProfile}.supr`),
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${mockProvider}.suma`
                    ),
                    provider: mockProvider,
                  },
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${secondMockProvider}.suma`
                    ),
                    provider: secondMockProvider,
                  },
                ],
              },
              {
                path: mockSuperJson.resolvePath(`../${secondMockProfile}.supr`),
                id: ProfileId.fromId(secondMockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${secondMockProfile}.${thirdMockProvider}.suma`
                    ),
                    provider: thirdMockProvider,
                  },
                ],
              },
            ],
            options: {
              onlyMap: undefined,
              onlyProfile: undefined,
            },
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles local profiles and maps file from super.json - only maps', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({ logger, flags: { onlyMap: true } })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          {
            profiles: [
              {
                path: mockSuperJson.resolvePath(`../${mockProfile}.supr`),
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${mockProvider}.suma`
                    ),
                    provider: mockProvider,
                  },
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${secondMockProvider}.suma`
                    ),
                    provider: secondMockProvider,
                  },
                ],
              },
              {
                path: mockSuperJson.resolvePath(`../${secondMockProfile}.supr`),
                id: ProfileId.fromId(secondMockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${secondMockProfile}.${thirdMockProvider}.suma`
                    ),
                    provider: thirdMockProvider,
                  },
                ],
              },
            ],
            options: { onlyMap: true, onlyProfile: undefined },
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles local profiles and maps file from super.json - only profiles', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({ logger, flags: { onlyProfile: true } })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          {
            profiles: [
              {
                path: mockSuperJson.resolvePath(`../${mockProfile}.supr`),
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${mockProvider}.suma`
                    ),
                    provider: mockProvider,
                  },
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${secondMockProvider}.suma`
                    ),
                    provider: secondMockProvider,
                  },
                ],
              },
              {
                path: mockSuperJson.resolvePath(`../${secondMockProfile}.supr`),
                id: ProfileId.fromId(secondMockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${secondMockProfile}.${thirdMockProvider}.suma`
                    ),
                    provider: thirdMockProvider,
                  },
                ],
              },
            ],
            options: { onlyMap: undefined, onlyProfile: true },
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles local profiles and maps file from super.json - quiet flag', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({ logger, flags: {} })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          {
            profiles: [
              {
                path: mockSuperJson.resolvePath(`../${mockProfile}.supr`),
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${mockProvider}.suma`
                    ),
                    provider: mockProvider,
                  },
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${secondMockProvider}.suma`
                    ),
                    provider: secondMockProvider,
                  },
                ],
              },
              {
                path: mockSuperJson.resolvePath(`../${secondMockProfile}.supr`),
                id: ProfileId.fromId(secondMockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${secondMockProfile}.${thirdMockProvider}.suma`
                    ),
                    provider: thirdMockProvider,
                  },
                ],
              },
            ],
            options: { onlyMap: undefined, onlyProfile: undefined },
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('compiling single profile', () => {
      it('compiles single local profile and its maps', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({ logger, flags: { profileId: mockProfile } })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          {
            profiles: [
              {
                path: mockSuperJson.resolvePath(`../${mockProfile}.supr`),
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${mockProvider}.suma`
                    ),
                    provider: mockProvider,
                  },
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${secondMockProvider}.suma`
                    ),
                    provider: secondMockProvider,
                  },
                ],
              },
            ],
            options: {
              onlyMap: undefined,
              onlyProfile: undefined,
            },
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles single local profile and its maps - only maps', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({
            logger,
            flags: { profileId: mockProfile, onlyMap: true },
          })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          {
            profiles: [
              {
                path: mockSuperJson.resolvePath(`../${mockProfile}.supr`),
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${mockProvider}.suma`
                    ),
                    provider: mockProvider,
                  },
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${secondMockProvider}.suma`
                    ),
                    provider: secondMockProvider,
                  },
                ],
              },
            ],
            options: { onlyMap: true, onlyProfile: undefined },
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles single local profile and its maps - only profiles', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({
            logger,
            flags: { profileId: mockProfile, onlyProfile: true },
          })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          {
            profiles: [
              {
                path: mockSuperJson.resolvePath(`../${mockProfile}.supr`),
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${mockProvider}.suma`
                    ),
                    provider: mockProvider,
                  },
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${secondMockProvider}.suma`
                    ),
                    provider: secondMockProvider,
                  },
                ],
              },
            ],
            options: { onlyMap: undefined, onlyProfile: true },
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('compiling single profile and single map', () => {
      it('compiles single local profile and single local map', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({
            logger,
            flags: {
              profileId: mockProfile,
              providerName: mockProvider,
            },
          })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          {
            profiles: [
              {
                path: mockSuperJson.resolvePath(`../${mockProfile}.supr`),
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${mockProvider}.suma`
                    ),
                    provider: mockProvider,
                  },
                ],
              },
            ],
            options: {
              onlyMap: undefined,
              onlyProfile: undefined,
            },
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles single local profile and single local map - only maps', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({
            logger,
            flags: {
              profileId: mockProfile,
              providerName: mockProvider,
              onlyMap: true,
            },
          })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          {
            profiles: [
              {
                path: mockSuperJson.resolvePath(`../${mockProfile}.supr`),
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${mockProvider}.suma`
                    ),
                    provider: mockProvider,
                  },
                ],
              },
            ],
            options: { onlyMap: true, onlyProfile: undefined },
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles single local profile and single local map - only profiles', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'load')
          .mockResolvedValue(ok(mockSuperJson));

        mocked(detectSuperJson).mockResolvedValue('.');
        mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({
            logger,
            flags: {
              profileId: mockProfile,
              providerName: mockProvider,
              onlyProfile: true,
            },
          })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          {
            profiles: [
              {
                path: mockSuperJson.resolvePath(`../${mockProfile}.supr`),
                id: ProfileId.fromId(mockProfile),
                maps: [
                  {
                    path: mockSuperJson.resolvePath(
                      `../${mockProfile}.${mockProvider}.suma`
                    ),
                    provider: mockProvider,
                  },
                ],
              },
            ],
            options: { onlyMap: undefined, onlyProfile: true },
          },
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
