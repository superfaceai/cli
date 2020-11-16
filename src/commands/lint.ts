import { Command, flags } from '@oclif/command';
import { CLIError } from '@oclif/errors';
import { Source, SyntaxError } from '@superfaceai/superface-parser';
import * as common from '../common';
import * as fs from 'fs';
import { Writable } from 'stream';

import { readFilePromise, streamWritePromise, streamEndPromise } from '../io';
import { formatWordPlurality } from '../util';

type FileReport = {
  path: string,
  errors: SyntaxError[],
  warnings: unknown[]
};

type OutputFormatFlag = 'long' | 'short' | 'json';
export default class Lint extends Command {
  static description = 'Lints a map or profile file. Outputs the linter issues to STDOUT by default.\nLinter ends with non zero exit code if errors are found.';

  // Require at least one file but allow multiple files
  static args = [{ name: 'file', required: true }];
  static strict = false;

  static flags = {
    documentType: common.documentTypeFlag,
    output: flags.string({
      char: 'o',
      description: 'Filename where the output will be written. `-` is stdout, `-2` is stderr.',
      default: '-'
    }),
    append: flags.boolean({
      default: false,
      description: 'Open output file in append mode instead of truncating it if it exists. Has no effect with stdout and stderr streams.'
    }),

    outputFormat: flags.build({
      char: 'f',
      description: 'Output format to use to display errors and warnings.',
      options: ['long', 'short', 'json'],
      parse(input, _context): OutputFormatFlag {
        // Sanity check
        if (input !== 'long' && input !== 'short' && input !== 'json') {
          throw new CLIError('Internal error: unexpected enum variant', { exit: -1 })
        }

        return input;
      }
    })({ default: 'long' }),
    color: flags.boolean({
      allowNo: true,
      description: 'Output colorized report. Only works for `human` output format. Set by default for stdout and stderr output.'
    }),

    help: flags.help({ char: 'h' }),
  };

  async run(): Promise<void> {
    const { argv, flags } = this.parse(Lint);

    let outputStream: Writable;
    let outputStreamIsStd: boolean;
    switch (flags.output) {
      case '-':
        outputStream = process.stdout;
        outputStreamIsStd = true;
        break;

      case '-2':
        outputStream = outputStream = process.stderr;
        outputStreamIsStd = true;
        break;

      default:
        outputStream = fs.createWriteStream(flags.output, {
          flags: flags.append ? 'a' : 'w',
          mode: 0o644,
          encoding: 'utf-8'
        });
        outputStreamIsStd = false;
        break;
    }

    switch (flags.outputFormat) {
      case 'long':
      case 'short':
        {
          const totals = await Lint.processFiles(
            outputStream, argv, flags.documentType,
            '\n',
            report => Lint.formatHuman(report, flags.outputFormat === 'short', flags.color ?? outputStreamIsStd)
          );
          await streamWritePromise(outputStream, `Detected ${formatWordPlurality(totals[0] + totals[1], 'problem')}\n`)
        }
        break;
      
      case 'json':
        {
          await streamWritePromise(outputStream, '{"reports":[');
          const totals = await Lint.processFiles(
            outputStream, argv, flags.documentType,
            ',',
            report => Lint.formatJson(report)
          );
          await streamWritePromise(outputStream, `],"total":{"errors":${totals[0]},"warnings":${totals[1]}}}\n`);
        }
        break;
    }

    // TODO: Should we also end stdout or stderr?
    if (!outputStreamIsStd) {
      await streamEndPromise(outputStream);
    }
  }

  static async processFiles(
    stream: Writable,
    files: string[],
    documentTypeFlag: common.DocumentTypeFlag,
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

          await streamWritePromise(stream, output);

          return [report.errors.length, report.warnings.length];
        }
      )
    );

    return counts.reduce(
      (acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]]
    );
  }

  static async lintFile(path: string, documentTypeFlag: common.DocumentTypeFlag): Promise<FileReport> {
    const documenType = common.inferDocumentTypeWithFlag(documentTypeFlag, path);
    if (documenType === common.DocumentType.UNKNOWN) {
      throw new CLIError("Could not infer document type", { exit: 1 });
    }

    const parse = common.DOCUMENT_PARSE_FUNCTION[documenType];
    const content = await readFilePromise(path).then(f => f.toString());
    const source = new Source(content, path);

    const result: FileReport = {
      path,
      errors: [],
      warnings: []
    };

    try {
      parse(source);
    } catch (e) {
      result.errors.push(e)
    };

    return result;
  }

  private static formatHuman(report: FileReport, short?: boolean, _color?: boolean): string {
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

    for (const _warning of report.warnings) {
      // TODO
    }

    return buffer;
  }

  private static formatJson(report: FileReport): string {
    return JSON.stringify(report, (key, value) => {
      if (key === 'source') {
        return undefined;
      }

      return value;
    })
  }
}
