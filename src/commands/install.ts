import { Command, flags } from '@oclif/command';

import { DEFAULT_PROFILE_VERSION } from '../common/document';
import { initSuperface } from '../logic/init';
import { detectSuperJson, installProfiles } from '../logic/install';

export default class Install extends Command {
  static description =
    'Initializes superface directory if needed, communicates with Superface registry, stores profiles and ASTs to a local system';

  static args = [
    {
      name: 'profileId',
      required: false,
      description:
        'Profile identifier consisting of scope (optional), profile name and its version.',
    },
  ];

  static flags = {
    // TODO
    providers: flags.string({
      char: 'p',
      description: 'Name of a Provider',
    }),
    // TODO
    version: flags.string({
      char: 'v',
      default: DEFAULT_PROFILE_VERSION,
      description: 'Version of a profile',
    }),
    help: flags.help({ char: 'h' }),
  };

  static examples = [
    '$ superface install',
    '$ superface install sms/service@1.0',
    '$ superface install sms/service -v 1.0',
    '$ superface install sms/service@1.0 -p twillio',
  ];

  async run(): Promise<void> {
    const { args } = this.parse(Install);
    const appPath = './';

    if (!(await detectSuperJson(appPath))) {
      await initSuperface(appPath, {}, {}, {});
    }

    await installProfiles(appPath, args.profileId);

    // TODO: downloads any missing profiles to <appPath>/superface/grid

    // TODO: generate typings to <appPath>/superface/types
  }
}
