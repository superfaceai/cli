import { CLIError } from '@oclif/errors';
import { SuperJson } from '@superfaceai/sdk';
import inquirer from 'inquirer';
import { stderr, stdout } from 'stdout-stderr';
import { mocked } from 'ts-jest/utils';

import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import { detectSuperJson, installProfiles } from '../logic/install';
import Install from './install';

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
  installProfiles: jest.fn(),
}));

//Mock configure logic
jest.mock('../logic/configure', () => ({
  installProvider: jest.fn(),
}));

//Mock inquirer
jest.mock('inquirer');

//Mock init logic
jest.mock('../logic/init', () => ({
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
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(inquirer).prompt.mockResolvedValue({ init: true });
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));

      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName])).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        'superface',
        [{ kind: 'store', profileId: profileName }],
        {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        }
      );
    }, 10000);

    it('calls install profiles correctly - non existing super.json - do NOT create new one', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(inquirer).prompt.mockResolvedValue({ init: false });
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));

      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName])).rejects.toEqual(
        new CLIError('EEXIT: 0')
      );
      expect(installProfiles).not.toHaveBeenCalled();
    }, 10000);

    it('calls install profiles correctly', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName])).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        '.',
        [{ kind: 'store', profileId: profileName }],
        {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        }
      );
    }, 10000);

    it('calls install profiles correctly with quiet flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName, '-q'])).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        '.',
        [{ kind: 'store', profileId: profileName }],
        {
          logCb: undefined,
          warnCb: undefined,
          force: false,
        }
      );
    }, 10000);

    it('throws error on empty providers flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName, '-p'])).rejects.toEqual(
        new CLIError('Flag --providers expects a value')
      );
      expect(installProfiles).toHaveBeenCalledTimes(0);
    }, 10000);

    it('throws error on invalid scan flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName, '-s test'])).rejects.toEqual(
        new CLIError('Expected an integer but received:  test')
      );
      expect(installProfiles).toHaveBeenCalledTimes(0);
    }, 10000);

    it('throws error on scan flag higher than 5', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName, '-s', '6'])).rejects.toEqual(
        new CLIError(
          '--scan/-s : Number of levels to scan cannot be higher than 5'
        )
      );
      expect(installProfiles).toHaveBeenCalledTimes(0);
    }, 10000);

    it('calls install profiles correctly - one invalid provider', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(installProvider).mockResolvedValue(undefined);
      const mockProviders = ['tyntec', 'twilio', 'made-up'];
      const profileName = 'starwars/character-information';

      await expect(
        Install.run([profileName, '-p', ...mockProviders])
      ).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        '.',
        [{ kind: 'store', profileId: profileName }],
        {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        }
      );
    }, 10000);
  });
});
