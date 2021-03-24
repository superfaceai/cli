import { CLIError } from '@oclif/errors';
import { mocked } from 'ts-jest/utils';

import { OutputStream } from '../common/output-stream';
import { lintFiles, lintMapsToProfile } from '../logic/lint';
import Lint from './lint';

//Mock output stream
jest.mock('../common/output-stream');

jest.mock('../logic/lint', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  ...jest.requireActual<Record<string, unknown>>('../logic/lint'),
  lintFiles: jest.fn(),
  lintMapsToProfile: jest.fn(),
}));

describe('lint CLI command', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  describe('lint CLI command', () => {
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
