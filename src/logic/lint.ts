import { MapHeaderNode } from '@superfaceai/ast';
import {
  formatIssues,
  getProfileOutput,
  parseMap,
  parseMapId,
  parseProfile,
  ProfileHeaderStructure,
  ProfileOutput,
  Source,
  SyntaxError,
  validateMap,
  ValidationResult,
} from '@superfaceai/parser';
import { basename } from 'path';

import {
  composeVersion,
  DOCUMENT_PARSE_FUNCTION,
  EXTENSIONS,
  inferDocumentTypeWithFlag,
  isMapFile,
  isProfileFile,
  isUnknownFile,
} from '../common/document';
import { DocumentType } from '../common/document.interfaces';
import { userError } from '../common/error';
import { DocumentTypeFlag } from '../common/flags';
import { readFile } from '../common/io';
import { ListWriter } from '../common/list-writer';
import {
  FileReport,
  ProfileMapReport,
  ReportFormat,
} from '../common/report.interfaces';

type ProfileDocument = ReturnType<typeof parseProfile>;
type MapDocument = ReturnType<typeof parseMap>;

export async function lintFiles(
  files: string[],
  writer: ListWriter,
  documentTypeFlag: DocumentTypeFlag,
  fn: (report: ReportFormat) => string
): Promise<[number, number][]> {
  return await Promise.all(
    files.map(
      async (file): Promise<[number, number]> => {
        const report = await lintFile(file, documentTypeFlag);

        await writer.writeElement(fn(report));

        return [report.errors.length, report.warnings.length];
      }
    )
  );
}

export async function lintFile(
  path: string,
  documentTypeFlag: DocumentTypeFlag
): Promise<FileReport> {
  const documentType = inferDocumentTypeWithFlag(documentTypeFlag, path);
  if (
    documentType !== DocumentType.MAP &&
    documentType !== DocumentType.PROFILE
  ) {
    throw userError('Could not infer document type', 3);
  }

  const parse = DOCUMENT_PARSE_FUNCTION[documentType];
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
  profileHeader: ProfileHeaderStructure,
  mapHeader: MapHeaderNode
): boolean {
  if (
    profileHeader.scope !== mapHeader.profile.scope ||
    profileHeader.name !== mapHeader.profile.name ||
    profileHeader.version.major !== mapHeader.profile.version.major ||
    profileHeader.version.minor !== mapHeader.profile.version.minor
  ) {
    return false;
  }

  return true;
}

export function isValidMapId(
  profileHeader: ProfileHeaderStructure,
  mapHeader: MapHeaderNode,
  mapPath: string
): boolean {
  const mapIdentifier = basename(mapPath, EXTENSIONS.map.source);
  const mapId = mapIdentifier.includes('@')
    ? mapIdentifier
    : `${mapIdentifier}@${composeVersion(mapHeader.profile.version, true)}`;
  const parsedMap = parseMapId(mapId);

  if (parsedMap.kind === 'error') {
    throw userError(parsedMap.message, 1);
  }

  const { name, version } = parsedMap.value;
  if (
    profileHeader.scope !== mapHeader.profile.scope ||
    profileHeader.name !== name ||
    profileHeader.version.major !== version.major ||
    profileHeader.version.minor !== version.minor
  ) {
    return false;
  }

  return true;
}

export const createProfileMapReport = (
  result: ValidationResult,
  profilePath: string,
  mapPath: string
): ProfileMapReport =>
  result.pass
    ? {
        kind: 'compatibility',
        profile: profilePath,
        path: mapPath,
        errors: [],
        warnings: result.warnings ?? [],
      }
    : {
        kind: 'compatibility',
        profile: profilePath,
        path: mapPath,
        errors: result.errors,
        warnings: result.warnings ?? [],
      };

export const createFileReport = (
  path: string,
  errors: SyntaxError[],
  warnings: string[]
): FileReport => ({
  kind: 'file',
  path,
  errors,
  warnings,
});

export async function lintMapsToProfile(
  files: string[],
  writer: ListWriter,
  fn: (report: ReportFormat) => string
): Promise<[number, number][]> {
  const counts: [number, number][] = [];
  const profiles = files.filter(isProfileFile);
  const maps = files.filter(isMapFile);
  const unknown = files.filter(isUnknownFile);

  if (profiles.length === 0) {
    throw userError('Cannot validate without profile', 1);
  }
  if (maps.length === 0) {
    throw userError('Cannot validate without map', 1);
  }

  if (unknown.length > 0) {
    for (const file of unknown) {
      const report = createFileReport(
        file,
        [],
        ['Could not infer document type']
      );

      await writer.writeElement(fn(report));
    }

    counts.push([0, unknown.length]);
  }

  const profileOutputs: Array<ProfileOutput & { path: string }> = [];
  const mapDocuments: Array<
    MapDocument & { path: string; matched: boolean }
  > = [];

  for (const profilePath of profiles) {
    profileOutputs.push({
      ...getProfileOutput(await getProfileDocument(profilePath)),
      path: profilePath,
    });
  }

  for (const mapPath of maps) {
    mapDocuments.push({
      ...(await getMapDocument(mapPath)),
      path: mapPath,
      matched: false,
    });
  }

  // loop over profiles and validate only maps that have valid header
  for (const profile of profileOutputs) {
    for (const map of mapDocuments) {
      if (isValidHeader(profile.header, map.header)) {
        const result = validateMap(profile, map);
        const report = createProfileMapReport(result, profile.path, map.path);

        await writer.writeElement(fn(report));

        counts.push([
          result.pass ? 0 : result.errors.length,
          result.warnings?.length ?? 0,
        ]);

        map.matched = true;
      }
    }
  }

  // loop over profiles and try to validate maps that did not match any profile
  for (const profile of profileOutputs) {
    for (const map of mapDocuments.filter(m => !m.matched)) {
      if (isValidMapId(profile.header, map.header, map.path)) {
        await writer.writeElement(
          `⚠️ map ${map.path} assumed to belong to profile ${profile.path} based on file name`
        );

        const result = validateMap(profile, map);
        const report = createProfileMapReport(result, profile.path, map.path);

        await writer.writeElement(fn(report));

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
    'profile' in report ? `➡️ Profile:\t${report.profile}\n` : '';
  let buffer = `${profileName}${prefix} ${report.path}\n`;

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

    if (!quiet && report.errors.length > 0 && report.warnings.length > 0) {
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
