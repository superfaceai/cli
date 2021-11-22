import { flags as oclifFlags } from '@oclif/command';
import { SuperJson } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import { Logger } from '..';
import { Command } from '../common/command.abstract';
import { META_FILE } from '../common/document';
import { userError } from '../common/error';
import { ProfileId } from '../common/profile';
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

  async run(): Promise<void> {
    const { flags } = this.parse(Generate);
    this.setUpLogger(flags.quiet);

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
    const profiles: { id: ProfileId; version?: string }[] = [];
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

      profiles.push({
        id: ProfileId.fromId(flags.profileId),
        version:
          'version' in profileSettings ? profileSettings.version : undefined,
      });
    } else {
      for (const [profile, profileSettings] of Object.entries(
        superJson.normalized.profiles
      )) {
        profiles.push({
          id: ProfileId.fromId(profile),
          version:
            'version' in profileSettings ? profileSettings.version : undefined,
        });
      }
    }

    await generate(profiles, superJson);

    Logger.success('generatedSuccessfully');
  }
}
