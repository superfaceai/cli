import { EXTENSIONS, MapDocumentNode, MapHeaderNode } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import {
  formatIssues,
  getProfileOutput,
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

import { composeVersion } from '../common/document';
import { userError } from '../common/error';
import { ListWriter } from '../common/list-writer';
import { LogCallback } from '../common/log';
import { ProfileId } from '../common/profile';
import {
  FileReport,
  ProfileMapReport,
  ReportFormat,
} from '../common/report.interfaces';
import { loadMap, loadProfile } from './publish.utils';

// export async function lintFiles(
//   files: string[],
//   writer: ListWriter,
//   documentTypeFlag: DocumentTypeFlag,
//   fn: (report: ReportFormat) => string
// ): Promise<[number, number][]> {
//   return await Promise.all(
//     files.map(
//       async (file): Promise<[number, number]> => {
//         const report = await lintFile(file, documentTypeFlag);

//         await writer.writeElement(fn(report));

//         return [report.errors.length, report.warnings.length];
//       }
//     )
//   );
// }

// export async function lintFile(
//   path: string,
//   documentTypeFlag: DocumentTypeFlag
// ): Promise<FileReport> {
//   const documentType = inferDocumentTypeWithFlag(documentTypeFlag, path);
//   if (
//     documentType !== DocumentType.MAP &&
//     documentType !== DocumentType.PROFILE
//   ) {
//     throw userError('Could not infer document type', 3);
//   }

//   const parse = DOCUMENT_PARSE_FUNCTION[documentType];
//   const content = await readFile(path, { encoding: 'utf-8' });
//   const source = new Source(content, path);

//   const result: FileReport = {
//     kind: 'file',
//     path,
//     errors: [],
//     warnings: [],
//   };

//   try {
//     parse(source);
//   } catch (e) {
//     result.errors.push(e);
//   }

//   return result;
// }
//TODO: rewrite to return validation issue?
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
//TODO: rewrite to return validation issue?
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

export type MapToLint = { provider: string; variant?: string; path?: string };
export type ProfileToLint = {
  id: ProfileId;
  maps: MapToLint[];
  version?: string;
  path?: string;
};

export async function lint(
  superJson: SuperJson,
  profiles: ProfileToLint[],
  writer: ListWriter,
  fn: (report: ReportFormat) => string,
  options?: {
    logCb?: LogCallback;
  }
): Promise<[number, number][]> {
  const counts: [number, number][] = [];
  type MapToLintWithOutput = MapToLint & { ast: MapDocumentNode; path: string };
  type ProfileToLintWithOutput = ProfileToLint & {
    output: ProfileOutput;
    source?: string;
    maps: MapToLintWithOutput[];
    path: string;
  };

  const profilesWithOutputs: ProfileToLintWithOutput[] = [];

  for (const profile of profiles) {
    const profileFiles = await loadProfile(
      superJson,
      profile.id,
      profile.version,
      options
    );
    const maps = [];

    for (const map of profile.maps) {
      maps.push({
        ...map,
        ast: (
          await loadMap(
            superJson,
            profile.id,
            map.provider,
            { variant: map.variant },
            profile.version,
            options
          )
        ).ast,
        //FIX: format of map id
        path: map.path ? map.path : ``,
      });
    }
    profilesWithOutputs.push({
      id: profile.id,
      output: getProfileOutput(profileFiles.ast),
      path: profile.path || profile.id.withVersion(profile.version),
      maps,
    });
  }

  // loop over profiles and validate maps
  for (const profile of profilesWithOutputs) {
    //TODO: what to do when there is a profile without maps?
    if (profile.maps.length === 0) {
      if (profile.source) {
        const result: FileReport = {
          kind: 'file',
          path: profile.path,
          errors: [],
          warnings: [],
        };

        try {
          parseProfile(new Source(profile.source, profile.path));
        } catch (e) {
          result.errors.push(e);
        }
      }
    } else {
      for (const map of profile.maps) {
        // if (isValidHeader(profile.output.header, map.ast.header)) {
        const result = validateMap(profile.output, map.ast);
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
