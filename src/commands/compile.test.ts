import { err, ok, SDKExecutionError } from '@superfaceai/one-sdk';
import * as SuperJson from '@superfaceai/one-sdk/dist/schema-tools/superjson/utils';
import { resolve as resolvePath } from 'path';

import { MockLogger } from '../common';
import { createUserError } from '../common/error';
import { ProfileId } from '../common/profile';
import { compile } from '../logic/compile';
import { detectSuperJson } from '../logic/install';
import { CommandInstance } from '../test/utils';
import Compile from './compile';

jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));
jest.mock('../logic/compile', () => ({
  compile: jest.fn(),
}));

describe('Compile CLI command', () => {
  const userError = createUserError(false, false);

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
    const mockSuperJson = {
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
    };

    beforeEach(() => {
      instance = CommandInstance(Compile);
      logger = new MockLogger();
    });

    it('throws when super.json not found', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(
        instance.execute({ logger, userError, flags: {} })
      ).rejects.toThrow('Unable to compile, super.json not found');
    });

    it('throws when super.json not loaded correctly', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(err(new SDKExecutionError('test error', [], [])));
      await expect(
        instance.execute({ logger, userError, flags: {} })
      ).rejects.toThrow('Unable to load super.json: test error');
    });

    it('throws error on scan flag higher than 5', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        instance.execute({ logger, userError, flags: { scan: 7 } })
      ).rejects.toThrow(
        '--scan/-s : Number of levels to scan cannot be higher than 5'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid profile id', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: 'U!0_',
            providerName: mockProvider,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        'Invalid profile id: "U!0_" is not a valid lowercase identifier'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid provider name', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: mockProfile,
            providerName: 'U!0_',
            scan: 3,
          },
        })
      ).rejects.toThrow('Invalid provider name: "U!0_"');
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error when provider name is specified but profile id is not', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: { providerName: mockProvider, scan: 3 },
        })
      ).rejects.toThrow(
        '--profileId must be specified when using --providerName'
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on missing profile id in super.json', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'loadSuperJson')
        .mockResolvedValue(ok({}));

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: mockProfile,
            providerName: mockProvider,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Unable to compile, profile: "${mockProfile}" not found in super.json`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    it('throws error on missing provider id in super.json', async () => {
      jest.mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest.spyOn(SuperJson, 'loadSuperJson').mockResolvedValue(
        ok({
          profiles: {
            [mockProfile]: {
              version: '1.0.0',
              defaults: {},
            },
          },
          providers: {},
        })
      );

      await expect(
        instance.execute({
          logger,
          userError,
          flags: {
            profileId: mockProfile,
            providerName: mockProvider,
            scan: 3,
          },
        })
      ).rejects.toThrow(
        `Unable to compile, provider: "${mockProvider}" not found in profile: "${mockProfile}" in super.json`
      );
      expect(detectSuperJson).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    }, 10000);

    describe('compiling whole super json', () => {
      it('compiles all local profiles and maps file from super.json and scan flag', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(mockSuperJson));

        jest.mocked(detectSuperJson).mockResolvedValue('.');
        jest.mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({ logger, userError, flags: { scan: 4 } })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          [
            {
              path: resolvePath(`../${mockProfile}.supr`),
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'profile',
            },

            {
              path: resolvePath(`../${mockProfile}.${mockProvider}.suma`),
              provider: mockProvider,
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'map',
            },
            {
              path: resolvePath(`../${mockProfile}.${secondMockProvider}.suma`),
              provider: secondMockProvider,
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'map',
            },

            {
              path: resolvePath(`../${secondMockProfile}.supr`),
              profileId: ProfileId.fromId(secondMockProfile, { userError }),
              kind: 'profile',
            },
            {
              path: resolvePath(
                `../${secondMockProfile}.${thirdMockProvider}.suma`
              ),
              profileId: ProfileId.fromId(secondMockProfile, { userError }),
              kind: 'map',
              provider: thirdMockProvider,
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles local profiles and maps file from super.json - only maps', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(mockSuperJson));

        jest.mocked(detectSuperJson).mockResolvedValue('.');
        jest.mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({ logger, userError, flags: { onlyMap: true } })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          [
            {
              path: resolvePath(`../${mockProfile}.${mockProvider}.suma`),
              provider: mockProvider,
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'map',
            },
            {
              path: resolvePath(`../${mockProfile}.${secondMockProvider}.suma`),
              provider: secondMockProvider,
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'map',
            },

            {
              path: resolvePath(
                `../${secondMockProfile}.${thirdMockProvider}.suma`
              ),
              provider: thirdMockProvider,
              profileId: ProfileId.fromId(secondMockProfile, { userError }),
              kind: 'map',
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles local profiles and maps file from super.json - only profiles', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(mockSuperJson));

        jest.mocked(detectSuperJson).mockResolvedValue('.');
        jest.mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({ logger, userError, flags: { onlyProfile: true } })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          [
            {
              path: resolvePath(`../${mockProfile}.supr`),
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'profile',
            },
            {
              path: resolvePath(`../${secondMockProfile}.supr`),
              profileId: ProfileId.fromId(secondMockProfile, { userError }),
              kind: 'profile',
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles local profiles and maps file from super.json - quiet flag', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(mockSuperJson));

        jest.mocked(detectSuperJson).mockResolvedValue('.');
        jest.mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({ logger, userError, flags: {} })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          [
            {
              path: resolvePath(`../${mockProfile}.supr`),
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'profile',
            },

            {
              path: resolvePath(`../${mockProfile}.${mockProvider}.suma`),
              provider: mockProvider,
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'map',
            },
            {
              path: resolvePath(`../${mockProfile}.${secondMockProvider}.suma`),
              provider: secondMockProvider,
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'map',
            },
            {
              path: resolvePath(`../${secondMockProfile}.supr`),
              profileId: ProfileId.fromId(secondMockProfile, { userError }),
              kind: 'profile',
            },
            {
              path: resolvePath(
                `../${secondMockProfile}.${thirdMockProvider}.suma`
              ),
              profileId: ProfileId.fromId(secondMockProfile, { userError }),
              kind: 'map',
              provider: thirdMockProvider,
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('compiling single profile', () => {
      it('compiles single local profile and its maps', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(mockSuperJson));

        jest.mocked(detectSuperJson).mockResolvedValue('.');
        jest.mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({
            logger,
            userError,
            flags: { profileId: mockProfile },
          })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          [
            {
              path: resolvePath(`../${mockProfile}.supr`),
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'profile',
            },
            {
              path: resolvePath(`../${mockProfile}.${mockProvider}.suma`),
              profileId: ProfileId.fromId(mockProfile, { userError }),
              provider: mockProvider,
              kind: 'map',
            },
            {
              path: resolvePath(`../${mockProfile}.${secondMockProvider}.suma`),
              profileId: ProfileId.fromId(mockProfile, { userError }),

              provider: secondMockProvider,
              kind: 'map',
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles single local profile and its maps - only maps', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(mockSuperJson));

        jest.mocked(detectSuperJson).mockResolvedValue('.');
        jest.mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({
            logger,
            userError,
            flags: { profileId: mockProfile, onlyMap: true },
          })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          [
            {
              path: resolvePath(`../${mockProfile}.${mockProvider}.suma`),
              provider: mockProvider,
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'map',
            },
            {
              path: resolvePath(`../${mockProfile}.${secondMockProvider}.suma`),
              provider: secondMockProvider,
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'map',
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles single local profile and its maps - only profiles', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(mockSuperJson));

        jest.mocked(detectSuperJson).mockResolvedValue('.');
        jest.mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({
            logger,
            userError,
            flags: { profileId: mockProfile, onlyProfile: true },
          })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          [
            {
              path: resolvePath(`../${mockProfile}.supr`),
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'profile',
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('compiling single profile and single map', () => {
      it('compiles single local profile and single local map', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(mockSuperJson));

        jest.mocked(detectSuperJson).mockResolvedValue('.');
        jest.mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {
              profileId: mockProfile,
              providerName: mockProvider,
            },
          })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          [
            {
              path: resolvePath(`../${mockProfile}.supr`),
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'profile',
            },
            {
              path: resolvePath(`../${mockProfile}.${mockProvider}.suma`),
              provider: mockProvider,
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'map',
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles single local profile and single local map - only maps', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(mockSuperJson));

        jest.mocked(detectSuperJson).mockResolvedValue('.');
        jest.mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {
              profileId: mockProfile,
              providerName: mockProvider,
              onlyMap: true,
            },
          })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          [
            {
              path: resolvePath(`../${mockProfile}.${mockProvider}.suma`),
              provider: mockProvider,
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'map',
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });

      it('compiles single local profile and single local map - only profiles', async () => {
        const loadSpy = jest
          .spyOn(SuperJson, 'loadSuperJson')
          .mockResolvedValue(ok(mockSuperJson));

        jest.mocked(detectSuperJson).mockResolvedValue('.');
        jest.mocked(compile).mockResolvedValue();

        await expect(
          instance.execute({
            logger,
            userError,
            flags: {
              profileId: mockProfile,
              providerName: mockProvider,
              onlyProfile: true,
            },
          })
        ).resolves.toBeUndefined();

        expect(compile).toHaveBeenCalledWith(
          [
            {
              path: resolvePath(`../${mockProfile}.supr`),
              profileId: ProfileId.fromId(mockProfile, { userError }),
              kind: 'profile',
            },
          ],
          expect.anything()
        );

        expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), undefined);
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
