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
import { green, red, yellow } from 'chalk';
import { basename } from 'path';

import {
  composeVersion,
  DEFAULT_PROFILE_VERSION_STR,
} from '../common/document';
import { userError } from '../common/error';
import { fetchMapAST, fetchProfileAST } from '../common/http';
import { ListWriter } from '../common/list-writer';
import { LogCallback } from '../common/log';
import { MapId } from '../common/map';
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
  let color: (inout: string) => string;

  if (report.errors.length > 0) {
    prefix = REPORT_ERR;
    color = red;
  } else if (report.warnings.length > 0) {
    prefix = REPORT_WARN;
    color = yellow;
  } else {
    prefix = REPORT_OK;
    color = green;
  }

  let buffer = '';

  if (report.kind === 'file') {
    buffer += color(
      `${prefix} Parsing ${report.path.endsWith(EXTENSIONS.profile.source) ? 'profile' : 'map'
      } file: ${report.path}\n`
    );
    for (const error of report.errors) {
      if (short) {
        buffer += red(
          `\t${error.location.line}:${error.location.column} ${error.message}\n`
        );
      } else {
        buffer += red(error.format());
      }
    }
    if (report.errors.length > 0 && report.warnings.length > 0) {
      buffer += '\n';
    }

    // TODO
    if (!quiet) {
      for (const warning of report.warnings) {
        if (typeof warning === 'string') {
          buffer += yellow(`\t${warning}\n`);
        }
      }
    }
  } else {
    buffer += color(
      `${prefix} Validating profile: ${report.profile} to map: ${report.path}\n`
    );

    buffer += red(formatIssues(report.errors));

    if (!quiet && report.errors.length > 0 && report.warnings.length > 0) {
      buffer += '\n';
    }

    if (!quiet) {
      buffer += yellow(formatIssues(report.warnings));
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

export type MapToValidate = { provider: string; variant?: string };
export type ProfileToValidate = {
  id: ProfileId;
  maps: MapToValidate[];
  version?: string;
};
type MapToLintWithAst = MapToValidate & {
  ast?: MapDocumentNode;
  path: string;
  counts: [number, number][];
};
type ProfileToLintWithAst = ProfileToValidate & {
  ast?: ProfileDocumentNode;
  path: string;
  counts: [number, number][];
};

async function prepareLintedProfile(
  superJson: SuperJson,
  profile: ProfileToValidate,
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
      path: profileSource.path || profile.id.withVersion(profile.version),
      errors: [],
      warnings: [],
    };

    try {
      profileAst = parseProfile(
        new Source(profileSource.source, profileSource.path)
      );
    } catch (e) {
      report.errors.push(e);
    }
    await writer.writeElement(fn(report));

    counts.push([report.errors.length, report.warnings.length]);
  } else {
    options?.logCb?.(
      `Loading profile: "${profile.id.id}" from Superface store`
    );
    profileAst = await fetchProfileAST(profile.id.id);
  }

  return {
    ...profile,
    ast: profileAst,
    path: profileSource?.path || profile.id.withVersion(profile.version),
    counts,
  };
}

async function prepareLintedMap(
  superJson: SuperJson,
  profile: ProfileToValidate,
  map: MapToValidate,
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
      path: mapSource.path,
      errors: [],
      warnings: [],
    };

    try {
      mapAst = parseMap(new Source(mapSource.source, mapSource.path));
    } catch (e) {
      report.errors.push(e);
    }
    await writer.writeElement(fn(report));

    counts.push([report.errors.length, report.warnings.length]);
  } else {
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

  const mapId = MapId.fromName({
    profile: {
      name: profile.id.name,
      scope: profile.id.scope,
    },
    provider: map.provider,
    variant: map.variant,
  });

  return {
    ...map,
    ast: mapAst,
    path:
      mapSource?.path ??
      mapId.withVersion(profile.version || DEFAULT_PROFILE_VERSION_STR),
    counts,
  };
}

export async function lint(
  superJson: SuperJson,
  profiles: ProfileToValidate[],
  writer: ListWriter,
  fn: (report: ReportFormat) => string,
  options?: {
    logCb?: LogCallback;
    errCb?: LogCallback;
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
    if (!profileWithAst.ast) {
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
      if (!preparedMap.ast) {
        return preparedMap.counts;
      }

      try {
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
        //We catch any unexpected error from parser validator to prevent ending the loop early
      } catch (error) {
        console.log('err', error)
        options?.errCb?.(
          `\n\n\nUnexpected error during validation of map: ${preparedMap.path} to profile: ${profileWithAst.path}.\nThis error is probably not a problem in linted files but in parser itself.\nTry updating CLI and its dependencies or report an issue.\n\n\n`
        );
      }
    }
  }

  return counts;
}
