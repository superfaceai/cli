import { flags as oclifFlags } from '@oclif/command';
import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { META_FILE } from '../common';
import { Command } from '../common/command.abstract';
import { developerError, userError } from '../common/error';
import { DocumentTypeFlag, documentTypeFlag } from '../common/flags';
import { formatWordPlurality } from '../common/format';
import { ListWriter } from '../common/list-writer';
import { OutputStream } from '../common/output-stream';
import { ReportFormat } from '../common/report.interfaces';
import { detectSuperJson } from '../logic/install';
import {
  formatHuman,
  formatJson,
  lintFiles,
  lintMapsToProfile,
} from '../logic/lint';

type OutputFormatFlag = 'long' | 'short' | 'json';
//TODO: decide if we want to merge check and lint. If we dont we need to refactor this to scope to one capability and to compile

export default class Lint extends Command {
  static description =
    'Lints maps and profiles locally linked in super.json. Path to single file can be provided. Outputs the linter issues to STDOUT by default.\nLinter ends with non zero exit code if errors are found.';

  // Allow multiple files
  static args = [{ name: 'file' }];
  static strict = false;

  static flags = {
    ...Command.flags,
    documentType: documentTypeFlag,

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

    color: oclifFlags.boolean({
      // TODO: Hidden because it doesn't do anything right now
      hidden: true,
      allowNo: true,
      description:
        'Output colorized report. Only works for `human` output format. Set by default for stdout and stderr output.',
    }),

    validate: oclifFlags.boolean({
      // TODO: extend or modify this
      char: 'v',
      default: false,
      description: 'Validate maps to specific profile.',
    }),

    scan: oclifFlags.integer({
      char: 's',
      description:
        'When number provided, scan for super.json outside cwd within range represented by this number.',
      required: false,
    }),
  };

  static examples = [
    '$ superface lint',
    '$ superface lint -o -2',
    '$ superface lint -f json',
    '$ superface lint my/path/to/sms/service@1.0',
    '$ superface lint -s',
  ];

  async run(): Promise<void> {
    const { argv, flags } = this.parse(Lint);

    if (flags.scan && (typeof flags.scan !== 'number' || flags.scan > 5)) {
      throw userError(
        '--scan/-s : Number of levels to scan cannot be higher than 5',
        1
      );
    }
    let files: string[] = [];
    if (!argv || argv.length === 0) {
      const superPath = await detectSuperJson(process.cwd(), flags.scan);
      if (!superPath) {
        throw userError('Unable to lint, super.json not found', 1);
      }
      //Load super json
      const loadedResult = await SuperJson.load(joinPath(superPath, META_FILE));
      const superJson = loadedResult.match(
        v => v,
        err => {
          throw userError(`Unable to load super.json: ${err.formatShort()}`, 1);
        }
      );
      for (const profile of Object.values(superJson.normalized.profiles)) {
        if ('file' in profile) {
          files.push(superJson.resolvePath(profile.file));
        }
        for (const profileProvider of Object.values(profile.providers))
          if ('file' in profileProvider) {
            files.push(superJson.resolvePath(profileProvider.file));
          }
      }
    } else {
      files = argv;
    }

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
            files,
            flags.documentType,
            flags.validate,
            report =>
              formatHuman(
                report,
                flags.quiet,
                flags.outputFormat === 'short',
                flags.color ?? outputStream.isTTY
              )
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
            files,
            flags.documentType,
            flags.validate,
            report => formatJson(report)
          );
          await outputStream.write(
            `],"total":{"errors":${totals[0]},"warnings":${totals[1]}}}\n`
          );
        }
        break;
    }

    await outputStream.cleanup();

    if (totals[0] > 0) {
      throw userError('Errors were found', 1);
    } else if (totals[1] > 0) {
      throw userError('Warnings were found', 2);
    }
  }

  static async processFiles(
    writer: ListWriter,
    files: string[],
    typeFlag: DocumentTypeFlag,
    validateFlag: boolean,
    fn: (report: ReportFormat) => string
  ): Promise<[errors: number, warnings: number]> {
    let counts: [number, number][] = [];

    if (validateFlag) {
      counts = await lintMapsToProfile(files, writer, fn);
    } else {
      counts = await lintFiles(files, writer, typeFlag, fn);
    }

    return counts.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]]);
  }
}
