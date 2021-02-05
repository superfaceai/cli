import { Command, flags } from '@oclif/command';
import { grey } from 'chalk';

import { SUPERFACE_DIR } from '../common/document';
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
    help: flags.help({ char: 'h' }),
  };

  static examples = [
    '$ superface install',
    '$ superface install sms/service@1.0',
    '$ superface install sms/service -v 1.0',
    '$ superface install sms/service@1.0 -p twillio',
  ];

  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { args } = this.parse(Install);
    let superPath = await detectSuperJson();

    if (!superPath) {
      await initSuperface('./', { profiles: {}, providers: {} }, {});
      superPath = SUPERFACE_DIR;
    }

    await installProfiles(superPath, args.profileId, {
      logCb: this.logCallback,
    });

    // TODO: downloads any missing profiles to <appPath>/superface/grid

    // TODO: generate typings to <appPath>/superface/types
  }
}
