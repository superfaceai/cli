import { CLIError } from '@oclif/errors';
import { err, ok, SuperJson } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { OutputStream } from '../common/output-stream';
import { detectSuperJson } from '../logic/install';
import { lintFiles, lintMapsToProfile } from '../logic/lint';
import Lint from './lint';

//Mock output stream
jest.mock('../common/output-stream');

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

//Mock init logic
jest.mock('../logic/lint', () => ({
  ...jest.requireActual<Record<string, unknown>>('../logic/lint'),
  lintFiles: jest.fn(),
  lintMapsToProfile: jest.fn(),
}));

describe('lint CLI command', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  describe('lint CLI command', () => {
    it('throws when super.json not found', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      await expect(Lint.run([])).rejects.toEqual(
        new CLIError('Unable to lint, super.json not found')
      );
    });

    it('throws when super.json not loaded correctly', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      jest.spyOn(SuperJson, 'load').mockResolvedValue(err('test error'));
      await expect(Lint.run([])).rejects.toEqual(
        new CLIError('Unable to load super.json: test error')
      );
    });

    it('throws error on invalid scan flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(Lint.run(['-s test'])).rejects.toEqual(
        new CLIError('Expected an integer but received:  test')
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on scan flag higher than 5', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(Lint.run(['-s', '6'])).rejects.toEqual(
        new CLIError(
          '--scan/-s : Number of levels to scan cannot be higher than 5'
        )
      );
      expect(detectSuperJson).not.toHaveBeenCalled();
    }, 10000);

    it('lints one profile and one map file from super.json and scan flag', async () => {
      const mockProfile = 'starwars/character-information';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfile]: {
            file: `../${mockProfile}.supr`,
            defaults: {},
            providers: {
              swapi: {
                file: `../${mockProfile}.swapi.suma`,
              },
            },
          },
        },
        providers: {
          swapi: {
            file: '../swapi.provider.json',
            security: [],
          },
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(lintFiles).mockResolvedValue([[0, 0]]);
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(Lint.run(['-s', '4'])).resolves.toBeUndefined();

      expect(lintFiles).toHaveBeenCalledTimes(1);
      expect(lintFiles).toHaveBeenCalledWith(
        [
          expect.stringContaining(`${mockProfile}.supr`),
          expect.stringContaining(`${mockProfile}.swapi.suma`),
        ],
        expect.anything(),
        'auto',
        expect.anything()
      );

      expect(detectSuperJson).toHaveBeenCalledWith(process.cwd(), 4);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(`\nDetected 0 problems\n`);

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('lints one profile and one map file from super.json', async () => {
      const mockProfile = 'starwars/character-information';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfile]: {
            file: `../${mockProfile}.supr`,
            defaults: {},
            providers: {
              swapi: {
                file: `../${mockProfile}.swapi.suma`,
              },
            },
          },
        },
        providers: {
          swapi: {
            file: '../swapi.provider.json',
            security: [],
          },
        },
      });
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(lintFiles).mockResolvedValue([[0, 0]]);
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(Lint.run([])).resolves.toBeUndefined();

      expect(lintFiles).toHaveBeenCalledTimes(1);
      expect(lintFiles).toHaveBeenCalledWith(
        [
          expect.stringContaining(`${mockProfile}.supr`),
          expect.stringContaining(`${mockProfile}.swapi.suma`),
        ],
        expect.anything(),
        'auto',
        expect.anything()
      );

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(`\nDetected 0 problems\n`);

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('lints one profile and one map file', async () => {
      mocked(lintFiles).mockResolvedValue([[0, 0]]);
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(
        Lint.run(['map-file.suma', 'profile-file.supr'])
      ).resolves.toBeUndefined();

      expect(lintFiles).toHaveBeenCalledTimes(1);
      expect(lintFiles).toHaveBeenCalledWith(
        ['map-file.suma', 'profile-file.supr'],
        expect.anything(),
        'auto',
        expect.anything()
      );

      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(`\nDetected 0 problems\n`);

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('lints one profile and one map file - json output', async () => {
      mocked(lintFiles).mockResolvedValue([[0, 0]]);
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(
        Lint.run(['map-file.suma', 'profile-file.supr', '-f', 'json'])
      ).resolves.toBeUndefined();

      expect(lintFiles).toHaveBeenCalledTimes(1);
      expect(lintFiles).toHaveBeenCalledWith(
        ['map-file.suma', 'profile-file.supr'],
        expect.anything(),
        'auto',
        expect.anything()
      );

      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy).toHaveBeenNthCalledWith(1, '{"reports":[');
      expect(writeSpy).toHaveBeenNthCalledWith(
        2,
        '],"total":{"errors":0,"warnings":0}}\n'
      );

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('lints one profile and one map file with validate flag', async () => {
      mocked(lintMapsToProfile).mockResolvedValue([[0, 0]]);
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(
        Lint.run(['map-file.suma', 'profile-file.supr', '-v'])
      ).resolves.toBeUndefined();

      expect(lintMapsToProfile).toHaveBeenCalledTimes(1);
      expect(lintMapsToProfile).toHaveBeenCalledWith(
        ['map-file.suma', 'profile-file.supr'],
        expect.anything(),
        expect.anything()
      );

      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(`\nDetected 0 problems\n`);

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('lints one invalid map file with validate flag - found warnings', async () => {
      mocked(lintMapsToProfile).mockResolvedValue([[0, 1]]);
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(Lint.run(['map-file.suma', '-v'])).rejects.toEqual(
        new CLIError('Warnings were found')
      );

      expect(lintMapsToProfile).toHaveBeenCalledTimes(1);
      expect(lintMapsToProfile).toHaveBeenCalledWith(
        ['map-file.suma'],
        expect.anything(),
        expect.anything()
      );

      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(`\nDetected 1 problem\n`);

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('lints one invalid map file with validate flag - found errors', async () => {
      mocked(lintMapsToProfile).mockResolvedValue([[1, 1]]);
      const writeSpy = jest
        .spyOn(OutputStream.prototype, 'write')
        .mockResolvedValue(undefined);
      const cleanupSpy = jest
        .spyOn(OutputStream.prototype, 'cleanup')
        .mockResolvedValue(undefined);

      await expect(Lint.run(['map-file.suma', '-v'])).rejects.toEqual(
        new CLIError('Errors were found')
      );

      expect(lintMapsToProfile).toHaveBeenCalledTimes(1);
      expect(lintMapsToProfile).toHaveBeenCalledWith(
        ['map-file.suma'],
        expect.anything(),
        expect.anything()
      );

      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(`\nDetected 2 problems\n`);

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });
  });
});
