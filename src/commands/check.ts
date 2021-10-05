import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName, SuperJson } from '@superfaceai/one-sdk';
import {
  DEFAULT_PROFILE_VERSION,
  MapId,
  MapVersion,
  parseDocumentId,
  ProfileId,
  ProfileVersion,
} from '@superfaceai/parser';
import { grey, yellow } from 'chalk';
import { join as joinPath } from 'path';

import { META_FILE } from '../common';
import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { check, formatHuman, formatJson } from '../logic/check';
import { detectSuperJson } from '../logic/install';

export default class Check extends Command {
  static strict = false;

  static description =
    'Checks if specified capability is correctly set up in super.json, has profile and map with corresponding version, scope, name, use case definitions and provider';

  static args = [];

  static flags = {
    ...Command.flags,
    //Inputs
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope/](optional)[name]',
      required: true,
    }),
    providerName: oclifFlags.string({
      description: 'Name of provider.',
      required: true,
    }),
    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
    json: oclifFlags.boolean({
      char: 'j',
      description: 'Formats result to JSON',
    }),
  };

  static examples = [
    '$ superface check --profileId starwars/character-information --providerName swapi',
    '$ superface check --profileId starwars/character-information --providerName swapi -j',
    '$ superface check --profileId starwars/character-information --providerName swapi -s 3',
    '$ superface check --profileId starwars/character-information --providerName swapi -q',
  ];

  private logCallback? = (message: string) => this.log(grey(message));
  private warnCallback? = (message: string) => this.log(yellow(message));

  async run(): Promise<void> {
    const { flags } = this.parse(Check);

    if (flags.quiet) {
      this.logCallback = undefined;
      this.warnCallback = undefined;
    }

    if (flags.scan && (typeof flags.scan !== 'number' || flags.scan > 5)) {
      throw userError(
        '--scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }

    //Load super json
    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (!superPath) {
      throw userError('Unable to check, super.json not found', 1);
    }
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err.formatShort()}`, 1);
      }
    );

    const parsedProfileId = parseDocumentId(flags.profileId);
    if (parsedProfileId.kind == 'error') {
      throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
    }

    if (!isValidProviderName(flags.providerName)) {
      throw userError(`Invalid provider name: "${flags.providerName}"`, 1);
    }

    let profileVersion: ProfileVersion | undefined = undefined;
    //Get profile info
    const profileSettings = superJson.normalized.profiles[flags.profileId];
    if (!profileSettings) {
      throw userError(
        `Profile id: "${flags.profileId}" not found in super.json`,
        1
      );
    }

    if ('version' in profileSettings) {
      profileVersion = ProfileVersion.fromString(profileSettings.version);
    }

    const profileId = ProfileId.fromParameters({
      scope: parsedProfileId.value.scope,
      version: profileVersion ?? DEFAULT_PROFILE_VERSION,
      name: parsedProfileId.value.middle[0],
    });

    //Get map info
    let variant: string | undefined = undefined;
    const profileProviderSettings =
      superJson.normalized.profiles[flags.profileId].providers[
        flags.providerName
      ];

    if (!profileProviderSettings) {
      throw userError(
        `Provider: "${flags.providerName}" not found in profile: "${flags.profileId}" in super.json`,
        1
      );
    }

    //TODO: how to resolve map revision??
    if ('mapVariant' in profileProviderSettings) {
      variant = profileProviderSettings.mapVariant;
    }

    const mapId = MapId.fromParameters({
      profile: profileId,
      provider: flags.providerName,
      version: MapVersion.fromVersionRange(
        profileId.version || DEFAULT_PROFILE_VERSION
      ),
      variant,
    });

    //Get provider info
    const providerSettings = superJson.normalized.providers[flags.providerName];

    if (!providerSettings) {
      throw userError(
        `Provider: "${flags.providerName}" not found in super.json`,
        1
      );
    }

    const result = await check(superJson, profileId, mapId, {
      logCb: this.logCallback,
      warnCb: this.warnCallback,
    });
    if (flags.json) {
      this.log(formatJson(result));
    } else {
      this.log(formatHuman(result));
    }
  }
}
