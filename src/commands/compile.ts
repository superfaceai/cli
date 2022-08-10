import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/ast';
import {
  loadSuperJson,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { dirname, join as joinPath, resolve as resolvePath } from 'path';

import { Command, Flags } from '../common/command.abstract';
import { META_FILE } from '../common/document';
import { UserError } from '../common/error';
import { ILogger } from '../common/log';
import { ProfileId } from '../common/profile';
import { compile, MapToCompile, ProfileToCompile } from '../logic/compile';
import { detectSuperJson } from '../logic/install';

export default class Compile extends Command {
  static description =
    'Compiles locally linked maps and profiles in `super.json`. When running without `--profileId` flag, all locally linked files are compiled. When running with `--profileId`, a single local profile source file, and all its local maps are compiled. When running with `--profileId` and `--providerName`, a single local profile and a single local map are compiled.';

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

  async run(): Promise<void> {
    const { flags } = this.parse(Compile);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
    });
  }

  async execute({
    logger,
    userError,
    flags,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Compile.flags>;
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

    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (!superPath) {
      throw userError('Unable to compile, super.json not found', 1);
    }
    //Load super json
    const superJsonPath = joinPath(superPath, META_FILE);
    const loadedResult = await loadSuperJson(superJsonPath, NodeFileSystem);
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err.formatShort()}`, 1);
      }
    );
    const normalized = normalizeSuperJsonDocument(superJson);

    //Check super.json
    if (flags.profileId) {
      if (!normalized.profiles[flags.profileId]) {
        throw userError(
          `Unable to compile, profile: "${flags.profileId}" not found in super.json`,
          1
        );
      }
      if (flags.providerName) {
        if (
          !normalized.profiles[flags.profileId].providers[flags.providerName]
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
        normalized.profiles
      )) {
        if ('file' in profileSettings) {
          const maps: MapToCompile[] = [];
          for (const [provider, profileProviderSettings] of Object.entries(
            profileSettings.providers
          )) {
            if ('file' in profileProviderSettings) {
              maps.push({
                path: resolvePath(
                  dirname(superJsonPath),
                  profileProviderSettings.file
                ),
                provider,
              });
            }
          }
          profiles.push({
            path: resolvePath(dirname(superJsonPath), profileSettings.file),
            maps,
            id: ProfileId.fromId(profile, { userError }),
          });
        }
      }
    }

    //Compile single local profile and its local maps
    if (flags.profileId && !flags.providerName) {
      const profileSettings = normalized.profiles[flags.profileId];
      if ('file' in profileSettings) {
        const maps: MapToCompile[] = [];

        for (const [provider, profileProviderSettings] of Object.entries(
          profileSettings.providers
        )) {
          if ('file' in profileProviderSettings) {
            maps.push({
              path: resolvePath(
                dirname(superJsonPath),
                profileProviderSettings.file
              ),
              provider,
            });
          }
        }
        profiles.push({
          path: resolvePath(dirname(superJsonPath), profileSettings.file),
          maps,
          id: ProfileId.fromId(flags.profileId, { userError }),
        });
      }
    }

    //Compile single profile and single map
    if (flags.profileId && flags.providerName) {
      const profileSettings = normalized.profiles[flags.profileId];
      const profileProviderSettings =
        profileSettings.providers[flags.providerName];
      if ('file' in profileSettings) {
        const maps: MapToCompile[] = [];

        if ('file' in profileProviderSettings) {
          maps.push({
            path: resolvePath(
              dirname(superJsonPath),
              profileProviderSettings.file
            ),
            provider: flags.providerName,
          });
        }
        profiles.push({
          path: resolvePath(dirname(superJsonPath), profileSettings.file),
          maps,
          id: ProfileId.fromId(flags.profileId, { userError }),
        });
      }
    }

    await compile(
      {
        profiles,
        options: {
          onlyMap: flags.onlyMap,
          onlyProfile: flags.onlyProfile,
        },
      },
      { logger, userError }
    );

    logger.success('compiledSuccessfully');
  }
}
