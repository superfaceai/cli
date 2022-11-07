import { flags as oclifFlags } from '@oclif/command';
import {
  loadSuperJson,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import { META_FILE } from '../common/document';
import type { UserError } from '../common/error';
import type { ILogger } from '../common/log';
import { ProfileId } from '../common/profile';
import { generate } from '../logic/generate';
import { detectSuperJson } from '../logic/install';

export default class Generate extends Command {
  public static hidden = true;

  public static description =
    'Generates types for specified profile or for all profiles in super.json.';

  public static flags = {
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

  public static strict = true;

  public static examples = [
    '$ superface generate --profileId starwars/character-information',
    '$ superface generate --profileId starwars/character-information -s 3',
    '$ superface generate',
    '$ superface generate -h',
    '$ superface generate -q',
  ];

  public async run(): Promise<void> {
    const { flags } = this.parse(Generate);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
    });
  }

  public async execute({
    logger,
    userError,
    flags,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof Generate.flags>;
  }): Promise<void> {
    if (
      flags.scan !== undefined &&
      (typeof flags.scan !== 'number' || flags.scan > 5)
    ) {
      throw userError(
        '--scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }

    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (superPath === undefined) {
      throw userError('Unable to generate, super.json not found', 1);
    }
    // Load super json
    const superJsonPath = joinPath(superPath, META_FILE);
    const loadedResult = await loadSuperJson(superJsonPath, NodeFileSystem);
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err.formatShort()}`, 1);
      }
    );
    const normalized = normalizeSuperJsonDocument(superJson);
    const profiles: { id: ProfileId; version?: string }[] = [];
    // Create generate requests
    if (flags.profileId !== undefined) {
      const parsedProfileId = parseDocumentId(flags.profileId);
      if (parsedProfileId.kind == 'error') {
        throw userError(`Invalid profile id: ${parsedProfileId.message}`, 1);
      }
      const profileSettings = normalized.profiles[flags.profileId];

      if (profileSettings === undefined) {
        throw userError(
          `Profile id: "${flags.profileId}" not found in super.json`,
          1
        );
      }

      profiles.push({
        id: ProfileId.fromId(flags.profileId, { userError }),
        version:
          'version' in profileSettings ? profileSettings.version : undefined,
      });
    } else {
      for (const [profile, profileSettings] of Object.entries(
        normalized.profiles
      )) {
        profiles.push({
          id: ProfileId.fromId(profile, { userError }),
          version:
            'version' in profileSettings ? profileSettings.version : undefined,
        });
      }
    }

    await generate({ profiles, superJson, superJsonPath }, { logger });

    logger.success('generatedSuccessfully');
  }
}
