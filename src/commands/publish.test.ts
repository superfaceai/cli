import { CLIError } from '@oclif/errors';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import { publish } from '../logic/publish';
import Publish from './publish';

//Mock publish logix
jest.mock('../logic/publish', () => ({
  publish: jest.fn(),
}));

describe('Publish CLI command', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running publish command', () => {
    const mockPath = './starwars/test.suma';

    it.skip('calls publish correctly', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(publish).mockResolvedValue(undefined);

      await expect(Publish.run([mockPath])).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith(mockPath, {
        logCb: expect.anything(),
        dryRun: false,
      });
    });

    it.skip('calls publish correctly with force flag', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(publish).mockResolvedValue(undefined);

      await expect(Publish.run([mockPath, '-f'])).resolves.toBeUndefined();

      expect(promptSpy).not.toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(mockPath, {
        logCb: expect.anything(),
        dryRun: false,
      });
    });

    it.skip('calls publish correctly with --dry-run', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(publish).mockResolvedValue(undefined);

      await expect(
        Publish.run([mockPath, '--dry-run'])
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith(mockPath, {
        logCb: expect.anything(),
        dryRun: true,
      });
    });

    it.skip('calls publish correctly with --quiet flag', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: true });
      mocked(publish).mockResolvedValue(undefined);

      await expect(Publish.run([mockPath, '-q'])).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith(mockPath, {
        logCb: undefined,
        dryRun: false,
      });
    });

    it.skip('does not call publish when user decline prompt', async () => {
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ upload: false });
      mocked(publish).mockResolvedValue(undefined);

      await expect(Publish.run([mockPath])).rejects.toEqual(
        new CLIError('EEXIT: 0')
      );

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(publish).not.toHaveBeenCalled();
    });
  });
});
