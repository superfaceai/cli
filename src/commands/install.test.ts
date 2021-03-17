import { CLIError } from '@oclif/errors';
import inquirer from 'inquirer';
import { stderr, stdout } from 'stdout-stderr';

import { initSuperface } from '../logic/init';
import { detectSuperJson, installProfiles } from '../logic/install';
import Install from './install';

//Mock install logic
jest.mock('../logic/install', () => ({
  /* eslint-disable */
  ...(jest.requireActual('../logic/install') as {}),
  /* eslint-ensable */
  detectSuperJson: jest.fn(),
  installProfiles: jest.fn(),
}));

//Mock inquirer
jest.mock('inquirer');

//Mock init logic
jest.mock('../logic/init', () => ({
  /* eslint-disable */
  ...(jest.requireActual('../logic/init') as {}),
  /* eslint-ensable */
  initSuperface: jest.fn(),
}));

describe('Install CLI command', () => {
  beforeEach(async () => {
    stderr.start();
    stdout.start();
  });

  afterEach(() => {
    jest.resetAllMocks();
    stderr.stop();
    stdout.stop();
  });

  describe('when running install command', () => {
    it('calls install profiles correctly - non existing super.json - create new one', async () => {
      (detectSuperJson as jest.Mock).mockResolvedValue(undefined);
      ((inquirer.prompt as unknown) as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ init: true });
      (initSuperface as jest.Mock).mockResolvedValue(undefined);

      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName])).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        'superface',
        profileName,
        [],
        {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        }
      );
    }, 10000);

    it('calls install profiles correctly - non existing super.json - do NOT create new one', async () => {
      (detectSuperJson as jest.Mock).mockResolvedValue(undefined);
      ((inquirer.prompt as unknown) as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ init: false });
      (initSuperface as jest.Mock).mockResolvedValue(undefined);

      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName])).rejects.toEqual(
        new CLIError('EEXIT: 0')
      );
      expect(installProfiles).not.toHaveBeenCalled();
    }, 10000);

    it('calls install profiles correctly', async () => {
      (detectSuperJson as jest.Mock).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName])).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith('.', profileName, [], {
        logCb: expect.anything(),
        warnCb: expect.anything(),
        force: false,
      });
    }, 10000);

    it('calls install profiles correctly with quiet flag', async () => {
      (detectSuperJson as jest.Mock).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName, '-q'])).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith('.', profileName, [], {
        logCb: undefined,
        warnCb: undefined,
        force: false,
      });
    }, 10000);

    it('throws error on empty providers flag', async () => {
      (detectSuperJson as jest.Mock).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName, '-p'])).rejects.toEqual(
        new CLIError('Flag --providers expects a value')
      );
      expect(installProfiles).toHaveBeenCalledTimes(0);
    }, 10000);

    it('throws error on invalid scan flag', async () => {
      (detectSuperJson as jest.Mock).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName, '-s test'])).rejects.toEqual(
        new CLIError('Expected an integer but received:  test')
      );
      expect(installProfiles).toHaveBeenCalledTimes(0);
    }, 10000);

    it('throws error on scan flag higher than 5', async () => {
      (detectSuperJson as jest.Mock).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName, '-s', '6'])).rejects.toEqual(
        new CLIError(
          '--scan/-s : Number of levels to scan cannot be higher than 5'
        )
      );
      expect(installProfiles).toHaveBeenCalledTimes(0);
    }, 10000);

    it('calls install profiles correctly - one invalid provider', async () => {
      (detectSuperJson as jest.Mock).mockResolvedValue('.');
      const mockProviders = ['tyntec', 'twilio', 'made-up'];
      const profileName = 'starwars/character-information';

      await expect(
        Install.run([profileName, '-p', ...mockProviders])
      ).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        '.',
        profileName,
        ['tyntec', 'twilio'],
        {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        }
      );
    }, 10000);
  });
});
