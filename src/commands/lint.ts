import { flags } from '@oclif/command';

import { Command } from '../common/command.abstract';
import { developerError, userError } from '../common/error';
import { DocumentTypeFlag, documentTypeFlag } from '../common/flags';
import { ListWriter } from '../common/list-writer';
import { OutputStream } from '../common/output-stream';
import { ReportFormat } from '../common/report.interfaces';
import {
  formatHuman,
  formatJson,
  lintFiles,
  lintMapsToProfile,
} from '../logic/lint';
import { formatWordPlurality } from '../util';

type OutputFormatFlag = 'long' | 'short' | 'json';

export default class Lint extends Command {
  static description =
    'Lints a map or profile file. Outputs the linter issues to STDOUT by default.\nLinter ends with non zero exit code if errors are found.';

  // Require at least one file but allow multiple files
  static args = [{ name: 'file', required: true }];
  static strict = false;

  static flags = {
    ...Command.flags,
    documentType: documentTypeFlag,

    output: flags.string({
      char: 'o',
      description:
        'Filename where the output will be written. `-` is stdout, `-2` is stderr.',
      default: '-',
    }),

    append: flags.boolean({
      default: false,
      description:
        'Open output file in append mode instead of truncating it if it exists. Has no effect with stdout and stderr streams.',
    }),

    outputFormat: flags.build({
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

    color: flags.boolean({
      // TODO: Hidden because it doesn't do anything right now
      hidden: true,
      allowNo: true,
      description:
        'Output colorized report. Only works for `human` output format. Set by default for stdout and stderr output.',
    }),

    validate: flags.boolean({
      // TODO: extend or modify this
      char: 'v',
      default: false,
      description: 'Validate maps to specific profile.',
    }),

    quiet: flags.boolean({
      char: 'q',
      default: false,
      description: 'When set to true, disables output of warnings.',
    }),

    help: flags.help({ char: 'h' }),
  };

  async run(): Promise<void> {
    const { argv, flags } = this.parse(Lint);

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
            argv,
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
            argv,
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
    documentTypeFlag: DocumentTypeFlag,
    validateFlag: boolean,
    fn: (report: ReportFormat) => string
  ): Promise<[errors: number, warnings: number]> {
    let counts: [number, number][] = [];

    if (validateFlag) {
      counts = await lintMapsToProfile(files, writer, fn);
    } else {
      counts = await lintFiles(files, writer, documentTypeFlag, fn);
    }

    return counts.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]]);
  }
}
