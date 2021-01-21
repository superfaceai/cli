import { Command, flags } from '@oclif/command';
import { CLIError } from '@oclif/errors';
import {
  formatIssues,
  getProfileOutput,
  MapDocumentId,
  ProfileDocumentId,
  Source,
  SyntaxError,
  validateMap,
  ValidationIssue,
} from '@superfaceai/parser';

import {
  DOCUMENT_PARSE_FUNCTION,
  DocumentType,
  inferDocumentTypeWithFlag,
  isMapFile,
  isProfileFile,
  isUnknownFile,
} from '../common/document';
import { developerError, userError } from '../common/error';
import { DocumentTypeFlag, documentTypeFlag } from '../common/flags';
import { OutputStream, readFile } from '../common/io';
import {
  getMapDocument,
  getMapHeader,
  getProfileDocument,
  getProfileHeader,
} from '../logic/lint';
import { formatWordPlurality } from '../util';

type ReportKind = 'file' | 'compatibility';

interface Report {
  kind: ReportKind;
  path: string;
}

interface FileReport extends Report {
  kind: 'file';
  errors: SyntaxError[];
  warnings: unknown[];
}

interface ProfileMapReport extends Report {
  kind: 'compatibility';
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

type ReportFormat = FileReport | ProfileMapReport;

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

    const outputStream = new OutputStream(flags.output, flags.append);
    let totals: [errors: number, warnings: number];

    switch (flags.outputFormat) {
      case 'long':
      case 'short':
        {
          totals = await Lint.processFiles(
            outputStream,
            argv,
            flags.documentType,
            flags.validate,
            '\n',
            report =>
              Lint.formatHuman(
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
            outputStream,
            argv,
            flags.documentType,
            flags.validate,
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

    if (totals[0] > 0) {
      throw userError('Errors were found', 1);
    } else if (totals[1] > 0) {
      throw userError('Warnings were found', 2);
    }
  }

  static async processFiles(
    outputStream: OutputStream,
    files: string[],
    documentTypeFlag: DocumentTypeFlag,
    validateFlag: boolean,
    outputGlue: string,
    fn: (report: ReportFormat) => string
  ): Promise<[errors: number, warnings: number]> {
    let outputCounter = files.length;
    let counts: [number, number][] = [];

    if (!validateFlag) {
      counts = await Promise.all(
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
    } else {
      counts = await Lint.lintMapsToProfile(
        files,
        outputStream,
        outputCounter,
        outputGlue,
        fn
      );
    }

    return counts.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]]);
  }

  static async lintFile(
    path: string,
    documentTypeFlag: DocumentTypeFlag
  ): Promise<FileReport> {
    const documenType = inferDocumentTypeWithFlag(documentTypeFlag, path);
    if (documenType === DocumentType.UNKNOWN) {
      throw userError('Could not infer document type', 3);
    }

    const parse = DOCUMENT_PARSE_FUNCTION[documenType];
    const content = await readFile(path).then(f => f.toString());
    const source = new Source(content, path);

    const result: FileReport = {
      kind: 'file',
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

  static async lintMapsToProfile(
    files: string[],
    outputStream: OutputStream,
    outputCounter: number,
    outputGlue: string,
    fn: (report: ReportFormat) => string
  ): Promise<[number, number][]> {
    const counts: [number, number][] = [];
    const profiles = files.filter(isProfileFile);
    const maps = files.filter(isMapFile);
    const unknown = files.filter(isUnknownFile);

    if (profiles.length === 0) {
      throw new CLIError('Cannot validate without profile', { exit: -1 });
    }
    if (maps.length === 0) {
      throw new CLIError('Cannot validate without map', {
        exit: -1,
      });
    }

    if (unknown.length > 0) {
      for (const file of unknown) {
        const report: FileReport = {
          kind: 'file',
          path: file,
          errors: [],
          warnings: ['Could not infer document type'],
        };

        let output = fn(report);
        if (unknown.length > 1 && output !== '') {
          output += outputGlue;
        }

        await outputStream.write(output);
      }

      counts.push([0, unknown.length]);
    }

    const profileHeaders: ProfileDocumentId[] = [];
    const profileDocuments = [];
    const mapHeaders: MapDocumentId[] = [];

    for (const profilePath of profiles) {
      profileDocuments.push(await getProfileDocument(profilePath));
      profileHeaders.push(await getProfileHeader(profilePath));
    }
    for (const mapPath of profiles) {
      mapHeaders.push(await getMapHeader(mapPath));
    }

    // loop over profiles and validate only maps that satify condition
    for (const profile of profileDocuments) {
      const profileOutput = getProfileOutput(profile);

      for (const mapPath of maps) {
        // TODO: create condition
        const result = validateMap(
          profileOutput,
          await getMapDocument(mapPath)
        );

        const report: ProfileMapReport = result.pass
          ? {
              kind: 'compatibility',
              path: mapPath,
              errors: [],
              warnings: result.warnings ?? [],
            }
          : {
              kind: 'compatibility',
              path: mapPath,
              errors: result.errors,
              warnings: result.warnings ?? [],
            };

        let output = fn(report);
        if (outputCounter > 1) {
          output += outputGlue;
        }
        outputCounter -= 1;

        await outputStream.write(output);

        counts.push([
          result.pass ? 0 : result.errors.length,
          result.warnings?.length ?? 0,
        ]);
      }
    }
    return counts;
  }

  private static formatHuman(
    report: ReportFormat,
    quiet: boolean,
    short?: boolean,
    _color?: boolean
  ): string {
    const REPORT_OK = '🆗';
    const REPORT_WARN = '⚠️';
    const REPORT_ERR = '❌';

    let prefix;
    if (report.errors.length > 0) {
      prefix = REPORT_ERR;
    } else if (report.warnings.length > 0) {
      prefix = REPORT_WARN;
    } else {
      prefix = REPORT_OK;
    }

    let buffer = `${prefix} ${report.path}\n`;

    if (prefix === REPORT_WARN && quiet) {
      return '';
    }

    if (report.kind === 'file') {
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
      if (!quiet) {
        for (const warning of report.warnings) {
          if (typeof warning === 'string') {
            buffer += `\t${warning}\n`;
          }
        }
      }
    } else {
      buffer += formatIssues(report.errors);

      if (!quiet) {
        if (report.warnings.length > 0) {
          buffer += '\n';
        }
        buffer += formatIssues(report.warnings);
      }
    }

    return buffer;
  }

  private static formatJson(report: ReportFormat): string {
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
