import { mocked } from 'ts-jest/utils';

import { MockLogger } from '../common';
import { createUserError } from '../common/error';
import { PackageManager } from '../common/package-manager';
import { ProfileId } from '../common/profile';
import { isCompatible } from '../logic';
import { installProvider } from '../logic/configure';
import { initSuperface } from '../logic/init';
import { detectSuperJson, installProfiles } from '../logic/install';
import { interactiveInstall } from '../logic/quickstart';
import { CommandInstance } from '../test/utils';
import Install from './install';

jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
  installProfiles: jest.fn(),
}));

jest.mock('../logic/configure', () => ({
  installProvider: jest.fn(),
}));

jest.mock('../logic/quickstart', () => ({
  interactiveInstall: jest.fn(),
}));

jest.mock('../logic/init', () => ({
  initSuperface: jest.fn(),
}));

jest.mock('../logic/configure.utils', () => ({
  isCompatible: jest.fn(),
}));

describe('Install CLI command', () => {
  let logger: MockLogger;
  let instance: Install;
  let pm: PackageManager;
  const userError = createUserError(false);

  beforeEach(async () => {
    logger = new MockLogger();
    pm = new PackageManager(logger);
    instance = CommandInstance(Install);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running install command', () => {
    it('calls install profiles correctly - failed to install profile - does not continue with install', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue({
        superJson: {},
        superJsonPath: '',
      });
      mocked(installProfiles).mockResolvedValue({ continueWithInstall: false });

      const profileName = 'starwars/character-information';

      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          args: { profileId: profileName },
          flags: {
            providers: [],
          },
        })
      ).rejects.toThrow('EEXIT: 0');
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        {
          superPath: 'superface',
          requests: [
            {
              kind: 'store',
              profileId: ProfileId.fromScopeName(
                'starwars',
                'character-information'
              ),
            },
          ],
          options: {
            tryToAuthenticate: true,
            force: false,
          },
        },
        expect.anything()
      );
    }, 10000);

    it('calls install profiles correctly - non existing super.json - create new one', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);
      mocked(initSuperface).mockResolvedValue({
        superJson: {},
        superJsonPath: '',
      });
      mocked(installProfiles).mockResolvedValue({ continueWithInstall: true });

      const profileName = 'starwars/character-information';

      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          args: { profileId: profileName },
          flags: {
            providers: [],
          },
        })
      ).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        {
          superPath: 'superface',
          requests: [
            {
              kind: 'store',
              profileId: ProfileId.fromScopeName(
                'starwars',
                'character-information'
              ),
            },
          ],
          options: {
            tryToAuthenticate: true,
            force: false,
          },
        },
        expect.anything()
      );
    }, 10000);

    it('calls install profiles correctly', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(isCompatible).mockResolvedValue(true);
      mocked(installProfiles).mockResolvedValue({ continueWithInstall: true });
      const profileName = 'starwars/character-information';

      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          args: { profileId: profileName },
          flags: {
            providers: [],
          },
        })
      ).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        {
          superPath: '.',
          requests: [
            {
              kind: 'store',
              profileId: ProfileId.fromScopeName(
                'starwars',
                'character-information'
              ),
            },
          ],
          options: {
            tryToAuthenticate: true,
            force: false,
          },
        },
        expect.anything()
      );
    }, 10000);

    it('calls install profiles correctly without profileId', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(installProfiles).mockResolvedValue({ continueWithInstall: true });

      await expect(
        instance.execute({
          logger,
          userError,
          pm,
          args: {},
          flags: {
            providers: [],
          },
        })
      ).resolves.toBeUndefined();
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        {
          superPath: '.',
          requests: [],
          options: {
            tryToAuthenticate: true,
            force: false,
          },
        },
        expect.anything()
      );
    }, 10000);

    it('throws error on incompatible providers', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(isCompatible).mockResolvedValue(false);
      const profileName = 'starwars/character-information';

      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          args: { profileId: profileName },
          flags: {
            providers: ['nope'],
          },
        })
      ).rejects.toThrow('EEXIT: 0');
      expect(installProfiles).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on empty profileId argument with providers flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');

      await expect(
        instance.execute({
          logger,
          userError,
          pm,
          args: {},
          flags: {
            providers: ['twilio'],
          },
        })
      ).rejects.toThrow('EEXIT: 0');
      expect(installProfiles).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid profileId', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'characterInformation';

      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          args: {
            profileId: profileName,
          },
          flags: {
            providers: [],
          },
        })
      ).rejects.toThrow();
      expect(installProfiles).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on invalid profileId with scope', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'starwars/characterInformation';

      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          args: {
            profileId: profileName,
          },
          flags: {
            providers: [],
          },
        })
      ).rejects.toThrow();
      expect(installProfiles).not.toHaveBeenCalled();
    }, 10000);

    it('throws error on empty providers flag', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(Install.run([profileName, '-p'])).rejects.toThrow(
        'Flag --providers expects a value'
      );
      expect(installProfiles).toHaveBeenCalledTimes(0);
    }, 10000);

    it('throws error on scan flag higher than 5', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileName = 'starwars/character-information';

      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          args: {
            profileId: profileName,
          },
          flags: {
            providers: [],
            scan: 6,
          },
        })
      ).rejects.toThrow(
        '--scan/-s : Number of levels to scan cannot be higher than 5'
      );
      expect(installProfiles).toHaveBeenCalledTimes(0);
    }, 10000);

    it('calls install profiles correctly - without providers', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const profileId = ProfileId.fromId('starwars/character-information', {
        userError,
      });
      mocked(installProfiles).mockResolvedValue({ continueWithInstall: true });

      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          flags: {
            providers: [],
          },
          args: {
            profileId: profileId.id,
          },
        })
      ).resolves.toBeUndefined();

      expect(logger.stdout).not.toContainEqual(['configuringProviders', []]);
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        {
          superPath: '.',
          requests: [
            {
              kind: 'store',
              profileId: ProfileId.fromScopeName(
                'starwars',
                'character-information'
              ),
              version: undefined,
            },
          ],
          options: {
            tryToAuthenticate: true,
            force: false,
          },
        },
        expect.anything()
      );
    }, 10000);

    it('calls install profiles correctly - one invalid provider', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(installProvider).mockResolvedValue(undefined);
      mocked(isCompatible).mockResolvedValue(true);
      const mockProviders = ['tyntec', 'twilio', 'made.up'];
      const profileId = ProfileId.fromId('starwars/character-information', {
        userError,
      });

      mocked(installProfiles).mockResolvedValue({ continueWithInstall: true });

      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          args: {
            profileId: profileId.id,
          },
          flags: {
            providers: mockProviders,
          },
        })
      ).resolves.toBeUndefined();

      expect(logger.stdout).toContainEqual([
        'invalidProviderName',
        ['made.up'],
      ]);
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        {
          superPath: '.',
          requests: [
            {
              kind: 'store',
              profileId: ProfileId.fromScopeName(
                'starwars',
                'character-information'
              ),
            },
          ],
          options: {
            tryToAuthenticate: true,
            force: false,
          },
        },
        expect.anything()
      );
      expect(installProvider).toHaveBeenCalledTimes(2);
      expect(installProvider).toHaveBeenNthCalledWith(
        1,
        {
          superPath: '.',
          provider: 'tyntec',
          profileId,
          defaults: undefined,
          options: {
            force: false,
          },
        },
        expect.anything()
      );
      expect(installProvider).toHaveBeenNthCalledWith(
        2,
        {
          superPath: '.',
          provider: 'twilio',
          profileId,
          defaults: undefined,
          options: {
            force: false,
          },
        },
        expect.anything()
      );
    }, 10000);

    it('calls install profiles correctly - providers separated by coma and space', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      mocked(installProvider).mockResolvedValue(undefined);
      mocked(isCompatible).mockResolvedValue(true);
      const profileId = ProfileId.fromId('starwars/character-information', {
        userError,
      });

      mocked(installProfiles).mockResolvedValue({ continueWithInstall: true });

      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          args: {
            profileId: profileId.id,
          },
          flags: {
            providers: ['tyntec', 'twilio', 'dhl-unified', 'github', 'made.up'],
          },
        })
      ).resolves.toBeUndefined();

      expect(logger.stdout).toContainEqual([
        'invalidProviderName',
        ['made.up'],
      ]);
      expect(installProfiles).toHaveBeenCalledTimes(1);
      expect(installProfiles).toHaveBeenCalledWith(
        {
          superPath: '.',
          requests: [
            {
              kind: 'store',
              profileId: ProfileId.fromScopeName(
                'starwars',
                'character-information'
              ),
            },
          ],
          options: {
            tryToAuthenticate: true,
            force: false,
          },
        },
        expect.anything()
      );
      expect(installProvider).toHaveBeenCalledTimes(4);
      expect(installProvider).toHaveBeenNthCalledWith(
        1,
        {
          superPath: '.',
          provider: 'tyntec',
          profileId,
          defaults: undefined,
          options: {
            force: false,
          },
        },
        expect.anything()
      );
      expect(installProvider).toHaveBeenNthCalledWith(
        2,
        {
          superPath: '.',
          provider: 'twilio',
          profileId,
          defaults: undefined,
          options: {
            force: false,
          },
        },
        expect.anything()
      );
      expect(installProvider).toHaveBeenNthCalledWith(
        3,
        {
          superPath: '.',
          provider: 'dhl-unified',
          profileId,
          defaults: undefined,
          options: {
            force: false,
          },
        },
        expect.anything()
      );
      expect(installProvider).toHaveBeenNthCalledWith(
        4,
        {
          superPath: '.',
          provider: 'github',
          profileId,
          defaults: undefined,
          options: {
            force: false,
          },
        },
        expect.anything()
      );
    }, 10000);

    it('calls interactive install correctly', async () => {
      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          args: { profileId: 'scope/profile' },
          flags: {
            interactive: true,
            providers: [],
          },
        })
      ).resolves.toBeUndefined();
      expect(interactiveInstall).toHaveBeenCalledTimes(1);
    }, 10000);

    it('does not call interactive install when profile id argument is not set', async () => {
      await expect(
        instance.execute({
          logger,
          pm,
          userError,
          args: {},
          flags: {
            providers: [],
            interactive: true,
          },
        })
      ).rejects.toThrow('EEXIT: 1');
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
