import type {
  ProviderJson} from '@superfaceai/ast';
import {
  AssertionError,
  assertProviderJson,
 isValidProviderName } from '@superfaceai/ast';
import { basename } from 'path';

import type { Flags } from '../common/command.abstract';
import { Command } from '../common/command.abstract';
import type { UserError } from '../common/error';
import { buildProfilePath, buildProviderPath } from '../common/file-structure';
import { exists, readFile } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { newProfile } from '../logic/new';

export default class New extends Command {
  // TODO: add description
  public static description =
    'Generates Comlink profile from prepared API documentation. Comlink profile defines interface od API integration. Use name of provider as first argument and description of your use case as second argument';

  public static examples = [
    'superface new swapi "retrieve character\'s homeworld by their name',
  ];

  public static args = [
    {
      name: 'providerName',
      description: 'URL or path to the API documentation.',
      required: true,
    },
    {
      name: 'prompt',
      description:
        'API name. If not provided, it will be inferred from URL or file name.',
      required: false,
    },
  ];

  public static flags = {
    ...Command.flags,
  };

  public async run(): Promise<void> {
    const { flags, args } = this.parse(New);
    await super.initialize(flags);
    await this.execute({
      logger: this.logger,
      userError: this.userError,
      flags,
      args,
    });
  }

  public async execute({
    logger,
    userError,
    flags,
    args,
  }: {
    logger: ILogger;
    userError: UserError;
    flags: Flags<typeof New.flags>;
    args: { providerName?: string; prompt?: string };
  }): Promise<void> {
    const { providerName, prompt } = args;

    if (providerName === undefined) {
      throw userError(
        'Missing provider name. Please provide it as firsat argument.',
        1
      );
    }

    if (!isValidProviderName(providerName)) {
      throw userError('Invalid provider name', 1);
    }

    // TODO: length check?
    if (prompt === undefined) {
      throw userError(
        'Missing short description of your use case in natural language. Please provide it as second argument.',
        1
      );
    }

    if (!(await exists(buildProviderPath(providerName)))) {
      throw userError(
        `Provider ${providerName} does not exist. Make sure to tun "sf prepare" before running this command.`,
        1
      );
    }

    const providerJsonFile = await readFile(
      buildProviderPath(providerName),
      'utf-8'
    );
    let providerJson: ProviderJson;
    try {
      providerJson = JSON.parse(providerJsonFile) as ProviderJson;
    } catch (e) {
      throw userError(`Invalid provider.json file.`, 1);
    }

    try {
      assertProviderJson(providerJson);
    } catch (e) {
      if (e instanceof AssertionError) {
        throw userError(`Invalid provider.json file. ${e.message}`, 1);
      }
      throw userError(`Invalid provider.json file.`, 1);
    }

    if (providerName !== providerJson.name) {
      throw userError(
        `Provider name in provider.json file does not match provider name in command.`,
        1
      );
    }

    const profileResult = await newProfile(
      {
        providerJson,
        prompt,
        options: { quiet: flags.quiet },
      },
      { logger }
    );

    const profilePath = buildProfilePath(
      `${profileResult.scope !== undefined ? profileResult.scope + '.' : ''}${
        profileResult.name
      }`
    );

    // TODO: force flag? or overwrite by default?
    if (await exists(profilePath)) {
      throw userError(`Profile ${basename(profilePath)} already exists.`, 1);
    }

    await OutputStream.writeOnce(profilePath, profileResult.source);
  }
}
