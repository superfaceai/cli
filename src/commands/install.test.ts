import { CLIError } from '@oclif/errors';
import { SuperJson } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';
import { ProfileId } from '../common/profile';

import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import { detectSuperJson, installProfiles } from '../logic/install';
import { interactiveInstall } from '../logic/quickstart';
import { MockStd, mockStd } from '../test/mock-std';
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

//Mock interactive install logic
jest.mock('../logic/quickstart', () => ({
  interactiveInstall: jest.fn(),
}));

//Mock init logic
jest.mock('../logic/init', () => ({
  initSuperface: jest.fn(),
}));

describe('Install CLI command', () => {
  let stdout: MockStd;
  let stderr: MockStd;

  beforeEach(async () => {
    stdout = mockStd();
    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
    stderr = mockStd();
    jest
      .spyOn(process['stderr'], 'write')
      .mockImplementation(stderr.implementation);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running install command', () => {
    it('calls install profiles correctly - non existing super.json - create new one', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));

      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName])).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith({
        superPath: 'superface',
        requests: [
          {
            kind: 'store',
            profileId: ProfileId.fromScopeName('starwars', 'character-information')
          },
        ],
        options: {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        },
      });
    }, 10000);

    it('calls install profiles correctly', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName])).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith({
        superPath: '.',
        requests: [
          {
            kind: 'store',
            profileId: ProfileId.fromScopeName('starwars', 'character-information')
          },
        ],
        options: {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        },
      });
    }, 10000);

    it('calls install profiles correctly with quiet flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName, '-q'])).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith({
        superPath: '.',
        requests: [
          {
            kind: 'store',
            profileId: ProfileId.fromScopeName('starwars', 'character-information')
          },
        ],
        options: {
          logCb: undefined,
          warnCb: undefined,
          force: false,
        },
      });
    }, 10000);

    it('calls install profiles correctly without profileId', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(Install.run([])).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith({
        superPath: '.',
        requests: [],
        options: {
          logCb: expect.any(Function),
          warnCb: expect.any(Function),
          force: false,
        },
      });
    }, 10000);

    it('throws error on empty profileId argument with providers flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(Install.run(['--providers', 'twilio'])).rejects.toEqual(
        new CLIError('EEXIT: 0')
      );
      expect(installProfiles).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid profileId', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'characterInformation';

      await expect(Install.run([profileName])).rejects.toThrow()
      expect(installProfiles).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid profileId with scope', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'starwars/characterInformation';

      await expect(Install.run([profileName])).rejects.toThrow()
      expect(installProfiles).not.toHaveBeenCalled();
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
      const mockProviders = ['tyntec', 'twilio', 'made.up'];
      const profileId = ProfileId.fromId('starwars/character-information');

      await expect(
        Install.run([profileId.id, '-p', ...mockProviders])
      ).resolves.toBeUndefined();

      expect(stdout.output).toContain('Invalid provider name: made.up');
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith({
        superPath: '.',
        requests: [
          {
            kind: 'store',
            profileId: ProfileId.fromScopeName('starwars', 'character-information')
          },
        ],
        options: {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        },
      });
      expect(installProvider).toHaveBeenCalledTimes(2);
      expect(installProvider).toHaveBeenNthCalledWith(1, {
        superPath: '.',
        provider: 'tyntec',
        profileId,
        defaults: undefined,
        options: {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        },
      });
      expect(installProvider).toHaveBeenNthCalledWith(2, {
        superPath: '.',
        provider: 'twilio',
        profileId,
        defaults: undefined,
        options: {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        },
      });
    }, 10000);

    it('calls install profiles correctly - providers separated by coma and space', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(installProvider).mockResolvedValue(undefined);
      const profileId = ProfileId.fromId('starwars/character-information');

      await expect(
        Install.run([
          profileId.id,
          '-p',
          ',tyntec, twilio, , dhl-unified ,,github,made.up,',
        ])
      ).resolves.toBeUndefined();

      expect(stdout.output).toContain('Invalid provider name: made.up');
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith({
        superPath: '.',
        requests: [
          {
            kind: 'store',
            profileId: ProfileId.fromScopeName('starwars', 'character-information')
          },
        ],
        options: {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        },
      });
      expect(installProvider).toHaveBeenCalledTimes(4);
      expect(installProvider).toHaveBeenNthCalledWith(1, {
        superPath: '.',
        provider: 'tyntec',
        profileId,
        defaults: undefined,
        options: {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        },
      });
      expect(installProvider).toHaveBeenNthCalledWith(2, {
        superPath: '.',
        provider: 'twilio',
        profileId,
        defaults: undefined,
        options: {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        },
      });
      expect(installProvider).toHaveBeenNthCalledWith(3, {
        superPath: '.',
        provider: 'dhl-unified',
        profileId,
        defaults: undefined,
        options: {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        },
      });
      expect(installProvider).toHaveBeenNthCalledWith(4, {
        superPath: '.',
        provider: 'github',
        profileId,
        defaults: undefined,
        options: {
          logCb: expect.anything(),
          warnCb: expect.anything(),
          force: false,
        },
      });
    }, 10000);

    it('calls interactive install correctly', async () => {
      await expect(
        Install.run(['scope/profile', '-i'])
      ).resolves.toBeUndefined();
      expect(interactiveInstall).toHaveBeenCalledTimes(1);
    }, 10000);

    it('does not call interactive install when profile id argument is not set', async () => {
      await expect(Install.run(['-i'])).rejects.toThrow('EEXIT: 0');
      expect(interactiveInstall).not.toHaveBeenCalled();
    }, 10000);

    it('does not call interactive install when other flags are set', async () => {
      await expect(Install.run(['-i', '-q'])).rejects.toThrow(
        '--quiet= cannot also be provided when using --interactive='
      );
      await expect(Install.run(['-i', '-f'])).rejects.toThrow(
        '--force= cannot also be provided when using --interactive='
      );
      await expect(Install.run(['-i', '-p', 'mailchimp'])).rejects.toThrow(
        '--providers= cannot also be provided when using --interactive='
      );
      await expect(Install.run(['-i', '-l'])).rejects.toThrow(
        '--local= cannot also be provided when using --interactive='
      );
      await expect(Install.run(['-i', '-s', '2'])).rejects.toThrow(
        '--scan= cannot also be provided when using --interactive='
      );

      expect(interactiveInstall).not.toHaveBeenCalled();
    }, 10000);
  });
});
