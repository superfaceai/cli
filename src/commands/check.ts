import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName, SuperJson } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { grey, yellow } from 'chalk';
import { join as joinPath } from 'path';

import { DEFAULT_PROFILE_VERSION_STR, META_FILE } from '../common';
import { Command } from '../common/command.abstract';
import { userError } from '../common/error';
import { check } from '../logic/check';
import { detectSuperJson } from '../logic/install';

export default class Check extends Command {
  static strict = false;

  static description =
    'Checks if specified capability has profile and map with corresponding version, scope, name, use case definitions and provider';

  static args = [];

  static flags = {
    ...Command.flags,
    //Inputs
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope](optional)/[name]',
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
  };

  static examples = ['$ station check', '$ station check -q'];

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

    //Check inputs
    if (!flags.providerName) {
      throw userError(`Invalid command --providerName is required`, 1);
    }
    if (!flags.profileId) {
      throw userError(`Invalid command --profileId is required`, 1);
    }

    //Load super json
    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (!superPath) {
      throw userError('Unable to compile, super.json not found', 1);
    }
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err}`, 1);
      }
    );

    const parsedProfileId = parseDocumentId(flags.profileId);
    if (parsedProfileId.kind == 'error') {
      throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
    }

    if (!isValidProviderName(flags.providerName)) {
      throw userError(`Invalid provider name: "${flags.providerName}"`, 1);
    }

    const profile: {
      name: string;
      scope?: string;
      version?: string;
    } = {
      name: parsedProfileId.value.middle[0],
      scope: parsedProfileId.value.scope,
    };

    //Get profile info
    const profileSettings = superJson.normalized.profiles[flags.profileId];
    if (!profileSettings) {
      throw userError(
        `Profile id: "${flags.profileId}" not found in super.json`,
        1
      );
    }

    if ('version' in profileSettings) {
      profile.version = profileSettings.version;
    } else {
      profile.version = DEFAULT_PROFILE_VERSION_STR;
    }

    //Get map info
    const map: {
      variant?: string;
    } = {};
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
      map.variant = profileProviderSettings.mapVariant;
    }

    //Get provider info
    const providerSettings = superJson.normalized.providers[flags.providerName];

    if (!providerSettings) {
      throw userError(
        `Provider: "${flags.providerName}" not found in super.json`,
        1
      );
    }

    await check(superJson, profile, flags.providerName, map, {
      logCb: this.logCallback,
      warnCB: this.warnCallback,
    });
  }
}
