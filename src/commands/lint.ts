import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/ast';
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
import { developerError } from '../common/error';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { detectSuperJson } from '../logic/install';
import { formatHuman, formatJson, formatSummary, lint } from '../logic/lint';
import Check from './check';

type OutputFormatFlag = 'long' | 'short' | 'json';

export default class Lint extends Command {
  public static hidden = true;

  public static description =
    'Lints all maps and profiles locally linked in super.json. Also can be used to lint specific profile and its maps, in that case remote files can be used.Outputs the linter issues to STDOUT by default.\nLinter ends with non zero exit code if errors are found.';

  public static strict = true;

  public static flags = {
    ...Command.flags,
    providerName: oclifFlags.string({
      description: 'Provider name',
      required: false,
    }),
    profileId: oclifFlags.string({
      description: 'Profile Id in format [scope/](optional)[name]',
      required: false,
    }),

    output: oclifFlags.string({
      char: 'o',
      description:
        'Filename where the output will be written. `-` is stdout, `-2` is stderr.',
      default: '-',
    }),

    append: oclifFlags.boolean({
      default: false,
      description:
        'Open output file in append mode instead of truncating it if it exists. Has no effect with stdout and stderr streams.',
    }),

    outputFormat: oclifFlags.build({
      char: 'f',
      description: 'Output format to use to display errors and warnings.',
      options: ['long', 'short', 'json'],
      parse(input, _context): OutputFormatFlag {
        // Sanity check
        if (input !== 'long' && input !== 'short' && input !== 'json') {
          throw developerError('unexpected enum variant', 1);
        }

        return input;
      },
    })({ default: 'short' }),

    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
  };

  public static examples = [
    '$ superface lint',
    '$ superface lint -f long',
    '$ superface lint --profileId starwars/character-information',
    '$ superface lint --profileId starwars/character-information --providerName swapi',
    '$ superface lint -o -2',
    '$ superface lint -f json',
    '$ superface lint -s 3',
  ];

  public async run(): Promise<void> {
    const { flags } = this.parse(Lint);
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
    flags: Flags<typeof Lint.flags>;
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
      if (flags.profileId == undefined) {
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
    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (superPath === undefined) {
      throw userError('Unable to lint, super.json not found', 1);
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
    // Check super.json
    if (flags.profileId !== undefined) {
      if (normalized.profiles[flags.profileId] == undefined) {
        throw userError(
          `Unable to lint, profile: "${flags.profileId}" not found in super.json`,
          1
        );
      }
      if (flags.providerName !== undefined) {
        if (
          normalized.profiles[flags.profileId].providers[flags.providerName] ===
          undefined
        ) {
          throw userError(
            `Unable to lint, provider: "${flags.providerName}" not found in profile: "${flags.profileId}" in super.json`,
            1
          );
        }
      }
    }
    const profiles = Check.prepareProfilesToValidate(
      {
        superJson: normalized,
        profileId: flags.profileId,
        providerName: flags.providerName,
      },
      { userError }
    );

    const outputStream = new OutputStream(flags.output, {
      append: flags.append,
    });

    const result = await lint(superJson, superJsonPath, profiles, {
      logger,
      userError,
    });

    if (flags.outputFormat === 'long' || flags.outputFormat === 'short') {
      // Print everything
      if (flags.outputFormat === 'long') {
        for (const report of result.reports) {
          await outputStream.write(
            formatHuman({
              report,
              emoji: flags.noEmoji !== true,
              color: flags.noColor !== true,
            })
          );
        }
      }
      // Print only errors and warnings
      for (const report of result.reports.filter(
        r => r.errors.length || r.warnings.length
      )) {
        await outputStream.write(
          formatHuman({
            report,
            emoji: flags.noEmoji !== true,
            color: flags.noColor !== true,
          })
        );
      }

      await outputStream.write(
        formatSummary({
          fileCount: result.reports.length,
          errorCount: result.total.errors,
          warningCount: result.total.warnings,
          color: flags.noColor !== true,
        })
      );
    } else {
      await outputStream.write(formatJson(result));
    }

    await outputStream.cleanup();

    if (result.total.errors > 0) {
      throw userError('Errors were found', 1);
    } else if (result.total.warnings > 0) {
      logger.warn('warningsWereFound');
    }
  }
}
