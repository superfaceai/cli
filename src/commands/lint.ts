import { flags as oclifFlags } from '@oclif/command';
import { isValidProviderName } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { parseDocumentId } from '@superfaceai/parser';
import { bold, grey, red } from 'chalk';
import { join as joinPath } from 'path';

import { META_FILE } from '../common';
import { Command } from '../common/command.abstract';
import { developerError, userError } from '../common/error';
import { formatWordPlurality } from '../common/format';
import { ListWriter } from '../common/list-writer';
import { LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { ReportFormat } from '../common/report.interfaces';
import { detectSuperJson } from '../logic/install';
import {
  formatHuman,
  formatJson,
  lint,
  ProfileToValidate,
} from '../logic/lint';
import Check from './check';

type OutputFormatFlag = 'long' | 'short' | 'json';

export default class Lint extends Command {
  static description =
    'Lints all maps and profiles locally linked in super.json. Also can be used to lint specific profile and its maps, in that case remote files can be used.Outputs the linter issues to STDOUT by default.\nLinter ends with non zero exit code if errors are found.';

  static strict = true;

  static flags = {
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
    })({ default: 'long' }),

    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
  };

  static examples = [
    '$ superface lint',
    '$ superface lint --profileId starwars/character-information',
    '$ superface lint --profileId starwars/character-information --providerName swapi',
    '$ superface lint -o -2',
    '$ superface lint -f json',
    '$ superface lint -s 3',
  ];

  private logCallback? = (message: string) => this.log(grey(message));
  private errCallback? = (message: string) => this.log(red(bold(message)));

  async run(): Promise<void> {
    const { flags } = this.parse(Lint);

    if (flags.quiet) {
      this.logCallback = undefined;
      this.errCallback = undefined;
    }

    // Check inputs
    if (flags.profileId) {
      const parsedProfileId = parseDocumentId(flags.profileId);
      if (parsedProfileId.kind == 'error') {
        throw userError(`❌ Invalid profile id: ${parsedProfileId.message}`, 1);
      }
    }

    if (flags.providerName) {
      if (!isValidProviderName(flags.providerName)) {
        throw userError(`❌ Invalid provider name: "${flags.providerName}"`, 1);
      }
      if (!flags.profileId) {
        throw userError(
          `❌ --profileId must be specified when using --providerName`,
          1
        );
      }
    }

    if (flags.scan && (typeof flags.scan !== 'number' || flags.scan > 5)) {
      throw userError(
        '❌ --scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }
    const superPath = await detectSuperJson(process.cwd(), flags.scan);
    if (!superPath) {
      throw userError('❌ Unable to lint, super.json not found', 1);
    }
    //Load super json
    const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
    const superJson = loadedResult.match(
      v => v,
      err => {
        throw userError(
          `❌ Unable to load super.json: ${err.formatShort()}`,
          1
        );
      }
    );
    //Check super.json
    if (flags.profileId) {
      if (!superJson.normalized.profiles[flags.profileId]) {
        throw userError(
          `❌ Unable to lint, profile: "${flags.profileId}" not found in super.json`,
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
            `❌ Unable to lint, provider: "${flags.providerName}" not found in profile: "${flags.profileId}" in super.json`,
            1
          );
        }
      }
    }
    const profiles = Check.prepareProfilesToValidate(
      superJson,
      flags.profileId,
      flags.providerName
    );

    const outputStream = new OutputStream(flags.output, {
      append: flags.append,
    });
    let totals: [errors: number, warnings: number];

    switch (flags.outputFormat) {
      case 'long':
      case 'short':
        {
          totals = await Lint.processFiles(
            new ListWriter(outputStream, '\n'),
            superJson,
            profiles,
            report =>
              formatHuman(report, flags.quiet, flags.outputFormat === 'short'),
            { logCb: this.logCallback, errCb: this.errCallback }
          );
          await outputStream.write(
            `\nDetected ${formatWordPlurality(
              totals[0] + (flags.quiet ? 0 : totals[1]),
              'problem'
            )}\n`
          );
        }
        break;

      case 'json':
        {
          await outputStream.write('{"reports":[');
          totals = await Lint.processFiles(
            new ListWriter(outputStream, ','),
            superJson,
            profiles,
            report => formatJson(report),
            { logCb: undefined, errCb: this.errCallback }
          );
          await outputStream.write(
            `],"total":{"errors":${totals[0]},"warnings":${totals[1]}}}\n`
          );
        }
        break;
    }

    await outputStream.cleanup();

    if (totals[0] > 0) {
      throw userError('❌ Errors were found', 1);
    } else if (totals[1] > 0) {
      this.logCallback?.('⚠️ Warnings were found');
    }
  }

  static async processFiles(
    writer: ListWriter,
    superJson: SuperJson,
    profiles: ProfileToValidate[],
    fn: (report: ReportFormat) => string,
    options?: {
      logCb?: LogCallback;
      errCb?: LogCallback;
    }
  ): Promise<[errors: number, warnings: number]> {
    const counts: [number, number][] = await lint(
      superJson,
      profiles,
      writer,
      fn,
      options
    );

    return counts.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]], [
      0,
      0,
    ]);
  }
}
