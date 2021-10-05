import { flags as oclifFlags } from '@oclif/command';
import { SuperJson } from '@superfaceai/one-sdk';
import { parseDocumentId, ProfileId } from '@superfaceai/parser';
import { bold, green, grey, yellow } from 'chalk';
import { join as joinPath } from 'path';

import { Command } from '../common/command.abstract';
import { META_FILE } from '../common/document';
import { userError } from '../common/error';
import { generate } from '../logic/generate';
import { detectSuperJson } from '../logic/install';

export default class Generate extends Command {
  static hidden = true;

  static description =
    'Generates types for specified profile or for all profiles in super.json.';

  static flags = {
    ...Command.flags,
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope/](optional)[name]',
      required: false,
    }),
    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
  };

  static strict = true;

  static examples = [
    '$ superface generate --profileId starwars/character-information',
    '$ superface generate --profileId starwars/character-information -s 3',
    '$ superface generate',
    '$ superface generate -h',
    '$ superface generate -q',
  ];

  private logCallback? = (message: string) => this.log(grey(message));
  private warnCallback? = (message: string) => this.log(yellow(message));

  private successCallback? = (message: string) =>
    this.log(bold(green(message)));

  async run(): Promise<void> {
    const { flags } = this.parse(Generate);

    if (flags.quiet) {
      this.logCallback = undefined;
      this.successCallback = undefined;
      this.warnCallback = undefined;
    }

    if (flags.scan && (typeof flags.scan !== 'number' || flags.scan > 5)) {
      throw userError(
        '--scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }

    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (!superPath) {
      throw userError('Unable to generate, super.json not found', 1);
    }
    //Load super json
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err.formatShort()}`, 1);
      }
    );
    const profiles: ProfileId[] = [];
    //Creat generate requests
    if (flags.profileId) {
      const parsedProfileId = parseDocumentId(flags.profileId);
      if (parsedProfileId.kind == 'error') {
        throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
      }
      const profileSettings = superJson.normalized.profiles[flags.profileId];

      if (!profileSettings) {
        throw userError(
          `Profile id: "${flags.profileId}" not found in super.json`,
          1
        );
      }

      profiles.push(
        ProfileId.fromId(
          flags.profileId,
          'version' in profileSettings ? `@${profileSettings.version}` : ''
        )
      );
    } else {
      for (const [profile, profileSettings] of Object.entries(
        superJson.normalized.profiles
      )) {
        profiles.push(
          ProfileId.fromId(
            profile,
            'version' in profileSettings ? `@${profileSettings.version}` : ''
          )
        );
      }
    }

    await generate(profiles, superJson, {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
    });

    this.successCallback?.(`🆗 types generated successfully.`);
  }
}
