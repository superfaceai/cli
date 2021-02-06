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
    quiet: flags.boolean({
      char: 'q',
      description:
        'When set to true, disables the shell echo output of init actions.',
      default: false,
    }),
    force: flags.boolean({
      char: 'f',
      description:
        'When set to true and when profile exists in local filesystem, overwrite it.',
      default: false,
    }),
    help: flags.help({ char: 'h' }),
  };

  static examples = [
    '$ superface install',
    '$ superface install sms/service@1.0',
    '$ superface install sms/service -v 1.0',
    '$ superface install sms/service@1.0 -p twillio',
  ];

  private warnCallback? =  (message: string) => this.warn(message)
  private logCallback? = (message: string) => this.log(grey(message));

  async run(): Promise<void> {
    const { args, flags } = this.parse(Install);

    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;
    }

    let superPath = await detectSuperJson();

    if (!superPath) {
      await initSuperface('./', { profiles: {}, providers: {} }, {});
      superPath = SUPERFACE_DIR;
    }

    await installProfiles(
      superPath,
      {
        logCb: this.logCallback,
        warnCb: this.warnCallback,
        force: flags.force,
      },
      args.profileId
    );

    // TODO: downloads any missing profiles to <appPath>/superface/grid

    // TODO: generate typings to <appPath>/superface/types
  }
}
