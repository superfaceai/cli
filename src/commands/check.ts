import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import { ILogger, META_FILE } from '../common';
import { Command, Flags } from '../common/command.abstract';
import { UserError } from '../common/error';
import { ProfileId } from '../common/profile';
import { check, formatHuman, formatJson } from '../logic/check';
import { detectSuperJson } from '../logic/install';
import { MapToValidate, ProfileToValidate } from '../logic/lint';

export default class Check extends Command {
  static strict = false;

  static description =
    'Checks all maps, profiles and providers locally linked in super.json. Also can be used to check specific profile and its maps, in that case remote files can be used.\nCommand ends with non zero exit code if errors are found.';

  static args = [];

  static flags = {
    ...Command.flags,
    // Inputs
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope/](optional)[name]',
      required: false,
    }),
    providerName: oclifFlags.string({
      description: 'Name of provider.',
      required: false,
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
    failOnWarning: oclifFlags.boolean({
      char: 'f',
      description: 'When true command will fail on warning',
    }),
  };

  static examples = [
    '$ superface check',
    '$ superface check -f',
    '$ superface check --profileId starwars/character-information',
    '$ superface check --profileId starwars/character-information --providerName swapi',
    '$ superface check --profileId starwars/character-information --providerName swapi -j',
    '$ superface check --profileId starwars/character-information --providerName swapi -s 3',
    '$ superface check --profileId starwars/character-information --providerName swapi -q',
  ];

  async run(): Promise<void> {
    const { flags } = this.parse(Check);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
    });
  }

  async execute({
    logger,
    flags,
    userError,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Check.flags>;
  }): Promise<void> {
    // Check inputs
    if (flags.profileId) {
      const parsedProfileId = parseDocumentId(flags.profileId);
      if (parsedProfileId.kind == 'error') {
        throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
      }
    }

    if (flags.providerName) {
      if (!isValidProviderName(flags.providerName)) {
        throw userError(`Invalid provider name: "${flags.providerName}"`, 1);
      }
      if (!flags.profileId) {
        throw userError(
          '--profileId must be specified when using --providerName',
          1
        );
      }
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

    //Check super.json
    if (flags.profileId) {
      if (!superJson.normalized.profiles[flags.profileId]) {
        throw userError(
          `Unable to check, profile: "${flags.profileId}" not found in super.json`,
          1
        );
      }
      if (flags.providerName) {
        if (
          !superJson.normalized.profiles[flags.profileId].providers[
            flags.providerName
          ]
        ) {
          throw userError(
            `Unable to check, provider: "${flags.providerName}" not found in profile: "${flags.profileId}" in super.json`,
            1
          );
        }
        if (!superJson.normalized.providers[flags.providerName]) {
          throw userError(
            `Unable to check, provider: "${flags.providerName}" not found in super.json`,
            1
          );
        }
      }
    }

    const profilesToValidate = Check.prepareProfilesToValidate(
      {
        superJson,
        profileId: flags.profileId,
        providerName: flags.providerName,
      },
      { userError }
    );

    const result = await check(superJson, profilesToValidate, {
      logger,
    });
    if (flags.json) {
      this.log(formatJson(result));
    } else {
      this.log(
        formatHuman({
          checkResults: result,
          emoji: !flags.noEmoji,
          color: !flags.noColor,
        })
      );
    }
    const issues = result.flatMap(result => result.issues);
    const numOfErrros = issues.filter(issue => issue.kind === 'error').length;
    const numOfWarnings = issues.filter(issue => issue.kind === 'warn').length;
    if (numOfErrros > 0 || (flags.failOnWarning && numOfWarnings > 0)) {
      throw userError(
        `Command found ${numOfErrros} errors and ${numOfWarnings} warnings`,
        1
      );
    }
  }

  public static prepareProfilesToValidate(
    {
      superJson,
      profileId,
      providerName,
    }: {
      superJson: SuperJson;
      profileId?: string;
      providerName?: string;
    },
    { userError }: { userError: UserError }
  ): ProfileToValidate[] {
    const profiles: ProfileToValidate[] = [];
    //validate every local map/profile in super.json
    if (!profileId && !providerName) {
      for (const [profile, profileSettings] of Object.entries(
        superJson.normalized.profiles
      )) {
        if ('file' in profileSettings) {
          const maps: MapToValidate[] = [];
          for (const [provider, profileProviderSettings] of Object.entries(
            profileSettings.providers
          )) {
            if ('file' in profileProviderSettings) {
              maps.push({ provider });
            }
          }
          profiles.push({
            id: ProfileId.fromId(profile, { userError }),
            maps,
          });
        }
      }
    }

    //Validate single profile and its maps
    if (profileId && !providerName) {
      const profileSettings = superJson.normalized.profiles[profileId];
      const maps: MapToValidate[] = [];
      for (const [provider, profileProviderSettings] of Object.entries(
        profileSettings.providers
      )) {
        if ('file' in profileProviderSettings) {
          maps.push({ provider });
        } else {
          maps.push({ provider, variant: profileProviderSettings.mapVariant });
        }
      }
      if ('file' in profileSettings) {
        profiles.push({
          id: ProfileId.fromId(profileId, { userError }),
          maps,
        });
      } else {
        profiles.push({
          id: ProfileId.fromId(profileId, { userError }),
          maps,
          version: profileSettings.version,
        });
      }
    }
    //Validate single profile and single map
    if (profileId && providerName) {
      const profileSettings = superJson.normalized.profiles[profileId];
      const profileProviderSettings = profileSettings.providers[providerName];
      const maps: MapToValidate[] = [];
      if ('file' in profileProviderSettings) {
        maps.push({
          provider: providerName,
        });
      } else {
        maps.push({
          provider: providerName,
          variant: profileProviderSettings.mapVariant,
        });
      }
      if ('file' in profileSettings) {
        profiles.push({
          id: ProfileId.fromId(profileId, { userError }),
          maps,
        });
      } else {
        profiles.push({
          id: ProfileId.fromId(profileId, { userError }),
          maps,
          version: profileSettings.version,
        });
      }
    }

    return profiles;
  }
}
