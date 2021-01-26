import {
  formatIssues,
  getProfileOutput,
  parseMap,
  parseMapId,
  parseProfile,
  ProfileOutput,
  Source,
  validateMap,
} from '@superfaceai/parser';
import { basename } from 'path';

import {
  composeVersion,
  DOCUMENT_PARSE_FUNCTION,
  DocumentType,
  inferDocumentTypeWithFlag,
  isMapFile,
  isProfileFile,
  isUnknownFile,
  MAP_EXTENSIONS,
} from '../common/document';
import { userError } from '../common/error';
import { DocumentTypeFlag } from '../common/flags';
import { OutputStream, readFile } from '../common/io';
import {
  FileReport,
  ProfileMapReport,
  ReportFormat,
} from '../common/report.interfaces';

type ProfileDocument = ReturnType<typeof parseProfile>;
type MapDocument = ReturnType<typeof parseMap>;

export async function lintFiles(
  files: string[],
  outputStream: OutputStream,
  documentTypeFlag: DocumentTypeFlag,
  outputCounter: number,
  outputGlue: string,
  fn: (report: ReportFormat) => string
): Promise<[number, number][]> {
  return await Promise.all(
    files.map(
      async (file): Promise<[number, number]> => {
        const report = await lintFile(file, documentTypeFlag);

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
}

export async function lintFile(
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

export function isValidHeader(
  profile: ProfileOutput,
  map: MapDocument,
  mapPath: string
): boolean {
  const profileHeader = profile.header;
  const mapHeader = map.header;
  let result = true;

  if (
    profileHeader.scope !== mapHeader.profile.scope ||
    profileHeader.name !== mapHeader.profile.name ||
    (profileHeader.version.major !== mapHeader.profile.version.major &&
      profileHeader.version.minor !== mapHeader.profile.version.minor)
  ) {
    result = false;
  }

  // fallback: compare file names
  if (result === false) {
    const mapIdentifier = basename(mapPath, MAP_EXTENSIONS[0]);
    const mapId = mapIdentifier.includes('@')
      ? mapIdentifier
      : `${mapIdentifier}@${composeVersion(mapHeader.profile.version, true)}`;
    const parsedMap = parseMapId(mapId);

    if (parsedMap.kind === 'error') {
      throw userError(parsedMap.message, 1);
    }

    const { name, version } = parsedMap.value;
    if (
      profileHeader.scope === mapHeader.profile.scope ||
      profileHeader.name === name ||
      (profileHeader.version.major === version.major &&
        profileHeader.version.minor === version.minor)
    ) {
      result = true;
    }
  }

  return result;
}

export async function lintMapsToProfile(
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
    throw userError('Cannot validate without profile', -1);
  }
  if (maps.length === 0) {
    throw userError('Cannot validate without map', -1);
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
      if (output !== '') {
        output += outputGlue;
      }

      await outputStream.write(output);
    }

    counts.push([0, unknown.length]);
  }

  const profileDocuments: Array<ProfileDocument & { path: string }> = [];

  for (const profilePath of profiles) {
    profileDocuments.push({
      ...(await getProfileDocument(profilePath)),
      path: profilePath,
    });
  }

  // loop over profiles and validate only maps that have valid header
  for (const profile of profileDocuments) {
    const profileOutput = getProfileOutput(profile);

    for (const mapPath of maps) {
      const map = await getMapDocument(mapPath);

      if (isValidHeader(profileOutput, map, mapPath)) {
        const result = validateMap(profileOutput, map);

        const report: ProfileMapReport = result.pass
          ? {
              kind: 'compatibility',
              profile: profile.path,
              path: mapPath,
              errors: [],
              warnings: result.warnings ?? [],
            }
          : {
              kind: 'compatibility',
              profile: profile.path,
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
  }

  return counts;
}

export function formatHuman(
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

  const profileName =
    'profile' in report ? `➡️ Profile:\t${report.profile}` : '';
  let buffer = `${profileName}\n${prefix} ${report.path}\n`;

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

    if (!quiet && report.warnings.length > 1) {
      buffer += '\n';
    }

    if (!quiet) {
      buffer += formatIssues(report.warnings);
      buffer += '\n';
    }
  }

  return buffer;
}

export function formatJson(report: ReportFormat): string {
  return JSON.stringify(report, (key, value) => {
    if (key === 'source') {
      return undefined;
    }

    // we are just passing the value along, nothing unsafe about that
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  });
}

export async function getProfileDocument(
  path: string
): Promise<ProfileDocument> {
  const parseFunction = DOCUMENT_PARSE_FUNCTION[DocumentType.PROFILE];
  const content = (await readFile(path)).toString();
  const source = new Source(content, path);

  return parseFunction(source);
}

export async function getMapDocument(path: string): Promise<MapDocument> {
  const parseFunction = DOCUMENT_PARSE_FUNCTION[DocumentType.MAP];
  const content = (await readFile(path)).toString();
  const source = new Source(content, path);

  return parseFunction(source);
}
