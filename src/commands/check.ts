import { flags as oclifFlags } from '@oclif/command';
import type { NormalizedSuperJsonDocument } from '@superfaceai/ast';
import { isValidProviderName } from '@superfaceai/ast';
import {
  loadSuperJson,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import type { ILogger } from '../common';
import { META_FILE } from '../common';
import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { ProfileId } from '../common/profile';
import { check, formatHuman, formatJson } from '../logic/check';
import { detectSuperJson } from '../logic/install';
import type { MapToValidate, ProfileToValidate } from '../logic/lint';

export default class Check extends Command {
  public static strict = false;

  public static description =
    'Checks all maps, profiles and providers locally linked in super.json. Also can be used to check specific profile and its maps, in that case remote files can be used.\nCommand ends with non zero exit code if errors are found.';

  public static args = [];

  public static flags = {
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

  public static examples = [
    '$ superface check',
    '$ superface check -f',
    '$ superface check --profileId starwars/character-information',
    '$ superface check --profileId starwars/character-information --providerName swapi',
    '$ superface check --profileId starwars/character-information --providerName swapi -j',
    '$ superface check --profileId starwars/character-information --providerName swapi -s 3',
    '$ superface check --profileId starwars/character-information --providerName swapi -q',
  ];

  public async run(): Promise<void> {
    const { flags } = this.parse(Check);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
    });
  }

  public async execute({
    logger,
    flags,
    userError,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Check.flags>;
  }): Promise<void> {
    // Check inputs
    if (flags.profileId !== undefined) {
      const parsedProfileId = parseDocumentId(flags.profileId);
      if (parsedProfileId.kind == 'error') {
        throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
      }
    }

    if (flags.providerName !== undefined) {
      if (!isValidProviderName(flags.providerName)) {
        throw userError(`Invalid provider name: "${flags.providerName}"`, 1);
      }
      if (flags.profileId === undefined) {
        throw userError(
          '--profileId must be specified when using --providerName',
          1
        );
      }
    }
    if (
      flags.scan !== undefined &&
      (typeof flags.scan !== 'number' || flags.scan > 5)
    ) {
      throw userError(
        '--scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }

    // Load super json
    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (superPath === undefined) {
      throw userError('Unable to check, super.json not found', 1);
    }
    const superJsonPath = joinPath(superPath, META_FILE);
    const loadedResult = await loadSuperJson(superJsonPath, NodeFileSystem);
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err.formatShort()}`, 1);
      }
    );
    const normalized = normalizeSuperJsonDocument(superJson);

    // Check super.json
    if (flags.profileId !== undefined) {
      if (normalized.profiles[flags.profileId] === undefined) {
        throw userError(
          `Unable to check, profile: "${flags.profileId}" not found in super.json`,
          1
        );
      }
      if (flags.providerName !== undefined) {
        if (
          normalized.profiles[flags.profileId].providers[flags.providerName] ===
          undefined
        ) {
          throw userError(
            `Unable to check, provider: "${flags.providerName}" not found in profile: "${flags.profileId}" in super.json`,
            1
          );
        }
        if (normalized.providers[flags.providerName] === undefined) {
          throw userError(
            `Unable to check, provider: "${flags.providerName}" not found in super.json`,
            1
          );
        }
      }
    }

    const profilesToValidate = Check.prepareProfilesToValidate(
      {
        superJson: normalized,
        profileId: flags.profileId,
        providerName: flags.providerName,
      },
      { userError }
    );

    const result = await check(superJson, superJsonPath, profilesToValidate, {
      logger,
    });
    if (flags.json !== undefined) {
      this.log(formatJson(result));
    } else {
      this.log(
        formatHuman({
          checkResults: result,
          emoji: flags.noEmoji !== true,
          color: flags.noColor !== true,
        })
      );
    }
    const issues = result.flatMap(result => result.issues);
    const numOfErrros = issues.filter(issue => issue.kind === 'error').length;
    const numOfWarnings = issues.filter(issue => issue.kind === 'warn').length;
    if (
      numOfErrros > 0 ||
      (flags.failOnWarning === true && numOfWarnings > 0)
    ) {
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
      superJson: NormalizedSuperJsonDocument;
      profileId?: string;
      providerName?: string;
    },
    { userError }: { userError: UserError }
  ): ProfileToValidate[] {
    const profiles: ProfileToValidate[] = [];
    // validate every local map/profile in super.json
    if (profileId === undefined && providerName === undefined) {
      for (const [profile, profileSettings] of Object.entries(
        superJson.profiles
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

    // Validate single profile and its maps
    if (profileId !== undefined && providerName === undefined) {
      const profileSettings = superJson.profiles[profileId];
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
    // Validate single profile and single map
    if (profileId !== undefined && providerName !== undefined) {
      const profileSettings = superJson.profiles[profileId];
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
