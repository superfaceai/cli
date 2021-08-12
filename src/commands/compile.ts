import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { join as joinPath } from 'path';

import { Command } from '../common/command.abstract';
import { META_FILE } from '../common/document';
import { userError } from '../common/error';
import { exists, readFile } from '../common/io';
import { Parser } from '../common/parser';
import { detectSuperJson } from '../logic/install';

export default class Compile extends Command {
  static description =
    'Compiles files locally linked in super.json or the given profile or map.';

  static hidden = true;

  static flags = {
    ...Command.flags,
    //Inputs
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope](optional)/[name]',
      required: true,
    }),
    providerName: oclifFlags.string({
      description: 'Name of provider. This argument is used to compile map',
    }),
    //What do we compile
    profile: oclifFlags.boolean({
      description: 'Compile a profile',
      dependsOn: ['profileId'],
    }),
    map: oclifFlags.boolean({
      description: 'Compile a map',
      dependsOn: ['providerName', 'profileId'],
    }),
  };

  static strict = false;

  async run(): Promise<void> {
    const { flags } = this.parse(Compile);

    const superPath = await detectSuperJson(process.cwd());
    if (!superPath) {
      throw userError('Unable to compile, super.json not found', 1);
    }
    //Load super json
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(`Unable to load super.json: ${err}`, 1);
      }
    );
    //Check flags
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

    //Load profile
    if (flags.profile) {
      if (!('file' in profileSettings)) {
        throw userError(
          `Profile id: "${flags.profileId}" not locally linked in super.json`,
          1
        );
      }
      const path = superJson.resolvePath(profileSettings.file);

      if (!(await exists(path))) {
        throw userError(`Path: "${path}" does not exist`, 1);
      }

      const source = await readFile(path, { encoding: 'utf-8' });

      await Parser.parseProfile(
        source,
        flags.profileId,
        {
          profileName: parsedProfileId.value.middle[0],
          scope: parsedProfileId.value.scope,
        },
        true
      );
    }

    if (flags.map) {
      if (!flags.providerName) {
        throw userError(
          `Invalid command --providerName is required when compiling map`,
          1
        );
      }
      if (!isValidProviderName(flags.providerName)) {
        throw userError(`Invalid provider name: "${flags.providerName}"`, 1);
      }

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

      if (!('file' in profileProviderSettings)) {
        throw userError(
          `Provider: "${flags.providerName}" not locally linked in super.json in profile: "${flags.profileId}"`,
          1
        );
      }
      const path = superJson.resolvePath(profileProviderSettings.file);

      if (!(await exists(path))) {
        throw userError(`Path: "${path}" does not exist`, 1);
      }

      const source = await readFile(path, { encoding: 'utf-8' });

      await Parser.parseMap(
        source,
        flags.profileId,
        {
          profileName: parsedProfileId.value.middle[0],
          scope: parsedProfileId.value.scope,
          providerName: flags.providerName,
        },
        true
      );
    }
  }
}
