import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { bold, green, grey } from 'chalk';
import { join as joinPath } from 'path';

import { Command } from '../common/command.abstract';
import { META_FILE } from '../common/document';
import { userError } from '../common/error';
import { ProfileId } from '../common/profile';
import { compile, MapToCompile, ProfileToCompile } from '../logic/compile';
import { detectSuperJson } from '../logic/install';

export default class Compile extends Command {
  static description =
    'Compiles locally linked files in super.json. When running without --profileId flags all locally linked files are compiled. When running with --prfileId single local profile source and its local maps are compiled. When running with profileId and providerName single local profile and its single local map are compiled.';

  static hidden = true;

  static flags = {
    ...Command.flags,
    //Inputs
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope/](optional)[name]',
      required: false,
    }),
    providerName: oclifFlags.string({
      description: 'Name of provider. This argument is used to compile map',
    }),
    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
    //What do we compile
    onlyProfile: oclifFlags.boolean({
      description: 'Compile only a profile/profiles',
      exclusive: ['onlyMap'],
    }),
    onlyMap: oclifFlags.boolean({
      description: 'Compile only a map/maps',
      exclusive: ['onlyProfile'],
    }),
  };

  static strict = true;

  static examples = [
    '$ superface compile',
    '$ superface compile --profileId starwars/character-information --profile',
    '$ superface compile --profileId starwars/character-information --profile -q',
    '$ superface compile --profileId starwars/character-information --providerName swapi --onlyMap',
    '$ superface compile --profileId starwars/character-information --providerName swapi --onlyMap --onlyProfile',
  ];

  private logCallback? = (message: string) => this.log(grey(message));
  private successCallback? = (message: string) =>
    this.log(bold(green(message)));

  async run(): Promise<void> {
    const { flags } = this.parse(Compile);

    if (flags.quiet) {
      this.logCallback = undefined;
      this.successCallback = undefined;
    }

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
          `--profileId must be specified when using --providerName`,
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

    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (!superPath) {
      throw userError('Unable to compile, super.json not found', 1);
    }
    //Load super json
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
          `Unable to compile, profile: "${flags.profileId}" not found in super.json`,
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
            `Unable to compile, provider: "${flags.providerName}" not found in profile: "${flags.profileId}" in super.json`,
            1
          );
        }
      }
    }

    const profiles: ProfileToCompile[] = [];

    //Compile every local map/profile in super.json
    if (!flags.profileId && !flags.providerName) {
      for (const [profile, profileSettings] of Object.entries(
        superJson.normalized.profiles
      )) {
        if ('file' in profileSettings) {
          const maps: MapToCompile[] = [];
          for (const [provider, profileProviderSettings] of Object.entries(
            profileSettings.providers
          )) {
            if ('file' in profileProviderSettings) {
              maps.push({
                path: superJson.resolvePath(profileProviderSettings.file),
                provider,
              });
            }
          }
          profiles.push({
            path: superJson.resolvePath(profileSettings.file),
            maps,
            id: ProfileId.fromId(profile),
          });
        }
      }
    }

    //Compile single local profile and its local maps
    if (flags.profileId && !flags.providerName) {
      const profileSettings = superJson.normalized.profiles[flags.profileId];
      if ('file' in profileSettings) {
        const maps: MapToCompile[] = [];

        for (const [provider, profileProviderSettings] of Object.entries(
          profileSettings.providers
        )) {
          if ('file' in profileProviderSettings) {
            maps.push({
              path: superJson.resolvePath(profileProviderSettings.file),
              provider,
            });
          }
        }
        profiles.push({
          path: superJson.resolvePath(profileSettings.file),
          maps,
          id: ProfileId.fromId(flags.profileId),
        });
      }
    }

    //Compile single profile and single map
    if (flags.profileId && flags.providerName) {
      const profileSettings = superJson.normalized.profiles[flags.profileId];
      const profileProviderSettings =
        profileSettings.providers[flags.providerName];
      if ('file' in profileSettings) {
        const maps: MapToCompile[] = [];

        if ('file' in profileProviderSettings) {
          maps.push({
            path: superJson.resolvePath(profileProviderSettings.file),
            provider: flags.providerName,
          });
        }
        profiles.push({
          path: superJson.resolvePath(profileSettings.file),
          maps,
          id: ProfileId.fromId(flags.profileId),
        });
      }
    }

    await compile(profiles, {
      logCb: this.logCallback,
      onlyMap: flags.onlyMap,
      onlyProfile: flags.onlyProfile,
    });

    this.successCallback?.(`🆗 compiled successfully.`);
  }
}
