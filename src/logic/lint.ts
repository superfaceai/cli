import {
  EXTENSIONS,
  MapDocumentNode,
  MapHeaderNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import {
  formatIssues,
  getProfileOutput,
  parseMap,
  parseMapId,
  parseProfile,
  ProfileHeaderStructure,
  Source,
  SyntaxError,
  validateMap,
  ValidationResult,
} from '@superfaceai/parser';
import { basename } from 'path';

import { composeVersion } from '../common/document';
import { userError } from '../common/error';
import { fetchMapAST, fetchProfileAST } from '../common/http';
import { ListWriter } from '../common/list-writer';
import { LogCallback } from '../common/log';
import { ProfileId } from '../common/profile';
import {
  FileReport,
  ProfileMapReport,
  ReportFormat,
} from '../common/report.interfaces';
import { findLocalMapSource, findLocalProfileSource } from './check.utils';

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
  short?: boolean
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

    console.log('buf', buffer);
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
type MapToLintWithAst = MapToLint & {
  ast: MapDocumentNode;
  path: string;
  counts: [number, number][];
};
type ProfileToLintWithAst = ProfileToLint & {
  ast: ProfileDocumentNode;
  path: string;
  counts: [number, number][];
};

async function prepareLintedProfile(
  superJson: SuperJson,
  profile: ProfileToLint,
  writer: ListWriter,
  fn: (report: ReportFormat) => string,
  options?: {
    logCb?: LogCallback;
  }
): Promise<ProfileToLintWithAst> {
  const counts: [number, number][] = [];
  let profileAst: ProfileDocumentNode | undefined = undefined;
  const profileSource = await findLocalProfileSource(
    superJson,
    profile.id,
    profile.version
  );
  //If we have local profile we lint it
  if (profileSource) {
    options?.logCb?.(`Profile: "${profile.id.id}" found on local file system`);

    const report: FileReport = {
      kind: 'file',
      path: profile.path || profile.id.withVersion(profile.version),
      errors: [],
      warnings: [],
    };

    try {
      profileAst = parseProfile(new Source(profileSource, profile.path));
    } catch (e) {
      report.errors.push(e);
    }
    await writer.writeElement(fn(report));

    counts.push([report.errors.length, report.warnings.length]);
  }
  if (!profileAst) {
    options?.logCb?.(
      `Loading profile: "${profile.id.id}" from Superface store`
    );
    profileAst = await fetchProfileAST(profile.id.id);
  }

  return {
    ...profile,
    ast: profileAst,
    path: profile.path || profile.id.withVersion(profile.version),
    counts,
  };
}

async function prepareLintedMap(
  superJson: SuperJson,
  profile: ProfileToLint,
  map: MapToLint,
  writer: ListWriter,
  fn: (report: ReportFormat) => string,
  options?: {
    logCb?: LogCallback;
  }
): Promise<MapToLintWithAst> {
  const counts: [number, number][] = [];
  let mapAst: MapDocumentNode | undefined = undefined;

  const mapSource = await findLocalMapSource(
    superJson,
    profile.id,
    map.provider
  );
  if (mapSource) {
    options?.logCb?.(
      `Map for profile: "${profile.id.withVersion(
        profile.version
      )}" and provider: "${map.provider}" found on local filesystem`
    );
    const report: FileReport = {
      kind: 'file',
      path: map.path ? map.path : ``,
      errors: [],
      warnings: [],
    };

    try {
      mapAst = parseMap(new Source(mapSource, profile.path));
    } catch (e) {
      report.errors.push(e);
    }
    await writer.writeElement(fn(report));

    counts.push([report.errors.length, report.warnings.length]);
  }
  if (!mapAst) {
    options?.logCb?.(
      `Loading map for profile: "${profile.id.withVersion(
        profile.version
      )}" and provider: "${map.provider}" from Superface store`
    );
    mapAst = await fetchMapAST(
      profile.id.name,
      map.provider,
      profile.id.scope,
      profile.version,
      map.variant
    );
  }

  return {
    ...map,
    ast: mapAst,
    //FIX: format of map id
    path: map.path ? map.path : ``,
    counts,
  };
}

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

  for (const profile of profiles) {
    const profileWithAst = await prepareLintedProfile(
      superJson,
      profile,
      writer,
      fn,
      options
    );
    //Return if we have errors or warnings
    if (
      !profileWithAst.counts.every(count => count[0] === 0 && count[1] === 0)
    ) {
      return profileWithAst.counts;
    }

    for (const map of profile.maps) {
      const preparedMap = await prepareLintedMap(
        superJson,
        profile,
        map,
        writer,
        fn,
        options
      );
      //Return if we have errors or warnings
      if (preparedMap.counts.every(count => count[0] === 0 && count[1] === 0)) {
        return preparedMap.counts;
      }

      const result = validateMap(
        getProfileOutput(profileWithAst.ast),
        preparedMap.ast
      );
      const report = createProfileMapReport(
        result,
        profileWithAst.path,
        preparedMap.path
      );

      await writer.writeElement(fn(report));

      counts.push([
        result.pass ? 0 : result.errors.length,
        result.warnings?.length ?? 0,
      ]);
    }
  }

  return counts;
}
