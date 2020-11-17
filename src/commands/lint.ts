import { Command, flags } from '@oclif/command';
import { CLIError } from '@oclif/errors';
import { Source, SyntaxError } from '@superfaceai/superface-parser';

import {
  DOCUMENT_PARSE_FUNCTION,
  DocumentType,
  inferDocumentTypeWithFlag,
} from '../common/document';
import { DocumentTypeFlag, documentTypeFlag } from '../common/flags';
import { OutputStream, readFilePromise } from '../common/io';
import { formatWordPlurality } from '../util';

type FileReport = {
  path: string;
  errors: SyntaxError[];
  warnings: unknown[];
};

type OutputFormatFlag = 'long' | 'short' | 'json';
export default class Lint extends Command {
  static description =
    'Lints a map or profile file. Outputs the linter issues to STDOUT by default.\nLinter ends with non zero exit code if errors are found.';

  // Require at least one file but allow multiple files
  static args = [{ name: 'file', required: true }];
  static strict = false;

  static flags = {
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
          throw new CLIError('Internal error: unexpected enum variant', {
            exit: -1,
          });
        }

        return input;
      },
    })({ default: 'long' }),
    color: flags.boolean({
      allowNo: true,
      description:
        'Output colorized report. Only works for `human` output format. Set by default for stdout and stderr output.',
    }),

    help: flags.help({ char: 'h' }),
  };

  async run(): Promise<void> {
    const { argv, flags } = this.parse(Lint);

    const outputStream = new OutputStream(flags.output, flags.append);

    switch (flags.outputFormat) {
      case 'long':
      case 'short':
        {
          const totals = await Lint.processFiles(
            outputStream,
            argv,
            flags.documentType,
            '\n',
            report =>
              Lint.formatHuman(
                report,
                flags.outputFormat === 'short',
                flags.color ?? outputStream.isTTY
              )
          );
          await outputStream.write(
            `\nDetected ${formatWordPlurality(
              totals[0] + totals[1],
              'problem'
            )}\n`
          );
        }
        break;

      case 'json':
        {
          await outputStream.write('{"reports":[');
          const totals = await Lint.processFiles(
            outputStream,
            argv,
            flags.documentType,
            ',',
            report => Lint.formatJson(report)
          );
          await outputStream.write(
            `],"total":{"errors":${totals[0]},"warnings":${totals[1]}}}\n`
          );
        }
        break;
    }

    await outputStream.cleanup();
  }

  static async processFiles(
    outputStream: OutputStream,
    files: string[],
    documentTypeFlag: DocumentTypeFlag,
    outputGlue: string,
    fn: (report: FileReport) => string
  ): Promise<[errors: number, warnings: number]> {
    let outputCounter = files.length;

    const counts = await Promise.all(
      files.map(
        async (file): Promise<[number, number]> => {
          const report = await Lint.lintFile(file, documentTypeFlag);

          let output = fn(report);
          if (outputCounter > 1) {
            output += outputGlue;
          }
          outputCounter -= 1;

          await outputStream.write(output);

          return [report.errors.length, report.warnings.length];
        }
      )
    );

    return counts.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]]);
  }

  static async lintFile(
    path: string,
    documentTypeFlag: DocumentTypeFlag
  ): Promise<FileReport> {
    const documenType = inferDocumentTypeWithFlag(documentTypeFlag, path);
    if (documenType === DocumentType.UNKNOWN) {
      throw new CLIError('Could not infer document type', { exit: 1 });
    }

    const parse = DOCUMENT_PARSE_FUNCTION[documenType];
    const content = await readFilePromise(path).then(f => f.toString());
    const source = new Source(content, path);

    const result: FileReport = {
      path,
      errors: [],
      warnings: [],
    };

    try {
      parse(source);
    } catch (e) {
      result.errors.push(e);
    }

    return result;
  }

  private static formatHuman(
    report: FileReport,
    short?: boolean,
    _color?: boolean
  ): string {
    const FILE_OK = '🆗';
    const FILE_WARN = '⚠️';
    const FILE_ERR = '❌';

    let prefix;
    if (report.errors.length > 0) {
      prefix = FILE_ERR;
    } else if (report.warnings.length > 0) {
      prefix = FILE_WARN;
    } else {
      prefix = FILE_OK;
    }

    let buffer = `${prefix} ${report.path}\n`;

    for (const error of report.errors) {
      if (short) {
        buffer += `\t${error.location.line}:${error.location.column} ${error.message}\n`;
      } else {
        buffer += error.format();
      }
    }
    if (report.errors.length > 0 && report.warnings.length > 0) {
      buffer += '\n';
    }

    // TODO
    // for (const _warning of report.warnings) {
    // }

    return buffer;
  }

  private static formatJson(report: FileReport): string {
    return JSON.stringify(report, (key, value) => {
      if (key === 'source') {
        return undefined;
      }

      // we are just passing the value along, nothing unsafe about that
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    });
  }
}
