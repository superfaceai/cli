import { Command, flags } from '@oclif/command';
import { parseMap, parseProfile, Source } from '@superfaceai/superface-parser';
import { lstatSync, readFileSync, writeFileSync } from 'fs';
import { parse as pathParse, sep } from 'path'

import { detectFormat, SuperfaceFormat } from '../utils/detectFormat';

export default class Compile extends Command {
  static description = 'Compiles the given profile or map to AST';

  static flags = {
    format: flags.enum({
      char: 'f',
      options: ['autodetect', 'map', 'profile'],
      default: 'autodetect',
      description: 'File format to lint',
    }),
    compact: flags.boolean({
      char: 'c',
      default: false,
      description: 'Compact the JSON representation of the compilation output.'
    }),
    write: flags.boolean({
      char: 'w',
      default: undefined,
      description: 'Writes compiled file to disk with .ast.json extension to filesystem. The file is written alongside the source file if output dir/path is not specified by -o.'
    }),
    outputDest: flags.string({
      char: 'o',
      default: undefined,
      description: 'Specifies directory or filename where the compiled file should be written.'
    }),
    help: flags.help({ char: 'h' }),
  };

  static args = [{ name: 'file', required: true }];

  async run(): Promise<void> {
    const { args, flags } = this.parse(Compile);
    const path = args['file'] as string;
    const format = this.determineFormatFromFlagOrFile(flags.format, path);
    const parsedFile = this.parseFile(path, format);
    const json = JSON.stringify(parsedFile, undefined, flags.compact ? undefined : 2);
    const pathInfo = pathParse(path);
    if (flags.write || flags.outputDest) {
      let basePathAndFileName = `${pathInfo.dir}${sep}${pathInfo.base}`;
      let suffixes = '.ast.json';
      if (flags.outputDest) {
        if (lstatSync(flags.outputDest).isDirectory()) {
          basePathAndFileName = `${flags.outputDest}${sep}${pathInfo.base}`
        } else {
          basePathAndFileName = flags.outputDest;
          suffixes = '';
        }
      }
      writeFileSync(`${basePathAndFileName}${suffixes}`, json);
    } else {
      this.log(json);
    }

  }

  private parseFile(path: string, format: SuperfaceFormat): unknown {
    const pathInfo = pathParse(path);
    const fileContents = readFileSync(path).toString();
    const source = new Source(fileContents, pathInfo.base);
    const parsingFunction = this.determineParsingFunction(format);
    if (!parsingFunction) {
      this.error("Unable to autodetect file format. Use -f flag to specify file format or pass a file with either .suma or .supr extension.", { exit: 1 });
    }

    return parsingFunction(source);
  }

  private determineParsingFunction(format: SuperfaceFormat): ((source: Source) => unknown) | undefined {
    if (format == SuperfaceFormat.Profile) {
      return parseProfile;
    } else if (format == SuperfaceFormat.Map) {
      return parseMap;
    }

    return undefined;
  }

  private determineFormatFromFlagOrFile(formatFlag: string, path: string): SuperfaceFormat {
    if (formatFlag === 'autodetect') {
      return detectFormat(path);
    } else if (formatFlag == 'profile') {
      return SuperfaceFormat.Profile;
    } else if (formatFlag == 'map') {
      return SuperfaceFormat.Map;
    }

    return SuperfaceFormat.UNKNOWN;
  }
}
