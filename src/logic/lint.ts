import type {
  MapDocumentNode,
  MapHeaderNode,
  ProfileDocumentNode,
  SuperJsonDocument,
} from '@superfaceai/ast';
import { EXTENSIONS } from '@superfaceai/ast';
import type {
  ProfileHeaderStructure,
  ProfileOutput,
  ValidationIssue,
  ValidationResult,
} from '@superfaceai/parser';
import {
  formatIssues,
  getProfileOutput,
  parseMap,
  parseMapId,
  parseProfile,
  Source,
  SyntaxError,
  validateExamples,
  validateMap,
} from '@superfaceai/parser';
import { green, red, yellow } from 'chalk';
import { basename } from 'path';

import {
  composeVersion,
  DEFAULT_PROFILE_VERSION_STR,
} from '../common/document';
import type { UserError } from '../common/error';
import { formatWordPlurality } from '../common/format';
import { fetchMapAST, fetchProfileAST } from '../common/http';
import type { ILogger } from '../common/log';
import { MapId } from '../common/map';
import type { ProfileId } from '../common/profile';
import type {
  FileReport,
  ProfileMapReport,
  ReportFormat,
} from '../common/report.interfaces';
import { findLocalMapSource, findLocalProfileSource } from './check.utils';

// TODO: rewrite to return validation issue?
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
// TODO: rewrite to return validation issue?
export function isValidMapId(
  profileHeader: ProfileHeaderStructure,
  mapHeader: MapHeaderNode,
  mapPath: string,
  { userError }: { userError: UserError }
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

export function formatSummary({
  fileCount,
  errorCount,
  warningCount,
  color,
}: {
  fileCount: number;
  errorCount: number;
  warningCount: number;
  color: boolean;
}): string {
  const noColor = (input: string) => input;

  const buffer = `\n\nChecked ${formatWordPlurality(fileCount, 'file')}. `;
  let colorize: (inout: string) => string = noColor;
  if (errorCount > 0) {
    if (color) {
      colorize = red;
    }
  } else if (warningCount > 0) {
    if (color) {
      colorize = yellow;
    }
  } else {
    if (color) {
      colorize = green;
    }
  }

  return (
    buffer +
    colorize(
      `Detected ${formatWordPlurality(errorCount + warningCount, 'problem')}\n`
    )
  );
}

export function formatHuman({
  report,
  // quiet,
  emoji,
  color,
}: // short,
{
  report: ReportFormat;
  // quiet: boolean;
  emoji: boolean;
  color: boolean;
  // short?: boolean;
}): string {
  const REPORT_OK = '🆗';
  const REPORT_WARN = '⚠️';
  const REPORT_ERR = '❌';

  let prefix;
  const noColor = (input: string) => input;
  let colorize: (inout: string) => string = noColor;

  if (report.errors.length > 0) {
    prefix = emoji ? REPORT_ERR : '';
    if (color) {
      colorize = red;
    }
  } else if (report.warnings.length > 0) {
    prefix = emoji ? REPORT_WARN : '';
    if (color) {
      colorize = yellow;
    }
  } else {
    prefix = emoji ? REPORT_OK : '';
    if (color) {
      colorize = green;
    }
  }

  let buffer = '';

  if (report.kind === 'file') {
    buffer += colorize(
      `${prefix} Parsing ${
        report.path.endsWith(EXTENSIONS.profile.source) ? 'profile' : 'map'
      } file: ${report.path}\n`
    );

    // Format Errors
    for (const error of report.errors) {
      if (error instanceof SyntaxError) {
        buffer += color ? red(error.format()) : error.format();
      } else {
        buffer += color ? red(formatIssues([error])) : formatIssues([error]);

        if (report.errors.length > 0) {
          buffer += '\n';
        }
      }
    }

    if (report.errors.length > 0 && report.warnings.length > 0) {
      buffer += '\n';
    }

    // Format Warnings
    buffer += color
      ? yellow(formatIssues(report.warnings))
      : formatIssues(report.warnings);
    buffer += '\n';
  } else {
    buffer += colorize(
      `${prefix} Validating profile: ${report.profile} to map: ${report.path}\n`
    );

    // Format Errors
    buffer += color
      ? red(formatIssues(report.errors))
      : formatIssues(report.errors);

    if (report.errors.length > 0 && report.warnings.length > 0) {
      buffer += '\n';
    }

    // Format Warnings
    buffer += color
      ? yellow(formatIssues(report.warnings))
      : formatIssues(report.warnings);
    buffer += '\n';
  }

  return buffer;
}

export function formatJson(input: LintResult | ReportFormat): string {
  return JSON.stringify(
    input,
    (key, value) => {
      if (key === 'source') {
        return undefined;
      }

      // we are just passing the value along, nothing unsafe about that
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    },
    2
  );
}

export type MapToValidate = { provider: string; variant?: string };
export type ProfileToValidate = {
  id: ProfileId;
  maps: MapToValidate[];
  version?: string;
};

// Linted map and profile
type PreparedMap = MapToValidate & {
  path: string;
  ast?: MapDocumentNode;
  report: FileReport;
};

type PreparedProfile = ProfileToValidate & {
  path: string;
  ast?: ProfileDocumentNode;
  output?: ProfileOutput;
  report: FileReport;
};

async function prepareLintedProfile(
  superJson: SuperJsonDocument,
  superJsonPath: string,
  profile: ProfileToValidate
): Promise<PreparedProfile> {
  let ast: ProfileDocumentNode | undefined = undefined;
  let output: ProfileOutput | undefined = undefined;
  const profileSource = await findLocalProfileSource(
    superJson,
    superJsonPath,
    profile.id,
    profile.version
  );
  const path = profileSource?.path ?? profile.id.withVersion(profile.version);

  const report: FileReport = {
    kind: 'file',
    path,
    errors: [],
    warnings: [],
  };
  // If we have local profile we lint it
  if (profileSource) {
    try {
      ast = parseProfile(new Source(profileSource.source, profileSource.path));
    } catch (e) {
      report.errors.push(e as SyntaxError | ValidationIssue);
    }
  } else {
    ast = await fetchProfileAST(profile.id, profile.version);
  }

  // Validate examples
  if (ast) {
    output = getProfileOutput(ast);
    const examplesValidationResult = validateExamples(ast, output);

    if (!examplesValidationResult.pass) {
      report.errors.push(...examplesValidationResult.errors);
    }
    report.warnings.push(...(examplesValidationResult.warnings ?? []));
  }

  return {
    ...profile,
    ast,
    output,
    path,
    report,
  };
}

async function prepareLintedMap(
  superJson: SuperJsonDocument,
  superJsonPath: string,
  profile: ProfileToValidate,
  map: MapToValidate
): Promise<PreparedMap> {
  let ast: MapDocumentNode | undefined = undefined;

  const mapId = MapId.fromName({
    profile: {
      name: profile.id.name,
      scope: profile.id.scope,
    },
    provider: map.provider,
    variant: map.variant,
  });

  const mapSource = await findLocalMapSource(
    superJson,
    superJsonPath,
    profile.id,
    map.provider
  );

  const path =
    mapSource?.path ??
    mapId.withVersion(profile.version ?? DEFAULT_PROFILE_VERSION_STR);

  const report: FileReport = {
    kind: 'file',
    path,
    errors: [],
    warnings: [],
  };
  if (mapSource) {
    try {
      ast = parseMap(new Source(mapSource.source, mapSource.path));
    } catch (e) {
      report.errors.push(e as SyntaxError | ValidationIssue);
    }
  } else {
    ast = await fetchMapAST({
      name: profile.id.name,
      provider: map.provider,
      scope: profile.id.scope,
      version: profile.version,
      variant: map.variant,
    });
  }

  return {
    ...map,
    ast,
    report,
    path,
  };
}

export type LintResult = {
  reports: ReportFormat[];
  total: {
    errors: number;
    warnings: number;
  };
};

function prepareResult(reports: ReportFormat[]): LintResult {
  const total = {
    errors: 0,
    warnings: 0,
  };
  reports.forEach(report => {
    total.errors += report.errors.length;
    total.warnings += report.warnings.length;
  });

  return {
    reports,
    total,
  };
}

export async function lint(
  superJson: SuperJsonDocument,
  superJsonPath: string,
  profiles: ProfileToValidate[],
  { logger }: { logger: ILogger }
): Promise<LintResult> {
  const counts: [number, number][] = [];
  const reports: ReportFormat[] = [];

  for (const profile of profiles) {
    const preparedProfile = await prepareLintedProfile(
      superJson,
      superJsonPath,
      profile
    );

    reports.push(preparedProfile.report);

    // Return if we have errors or warnings
    if (!preparedProfile.ast || !preparedProfile.output) {
      return prepareResult(reports);
    }

    for (const map of profile.maps) {
      const preparedMap = await prepareLintedMap(
        superJson,
        superJsonPath,
        profile,
        map
      );
      reports.push(preparedMap.report);

      // Return if we have errors or warnings
      if (!preparedMap.ast) {
        return prepareResult(reports);
      }

      try {
        const result = validateMap(preparedProfile.output, preparedMap.ast);

        reports.push(
          createProfileMapReport(result, preparedProfile.path, preparedMap.path)
        );

        counts.push([
          result.pass ? 0 : result.errors.length,
          result.warnings?.length ?? 0,
        ]);
        // We catch any unexpected error from parser validator to prevent ending the loop early
      } catch (error) {
        logger.error(
          'unexpectedLintError',
          preparedMap.path,
          preparedProfile.path
        );
      }
    }
  }

  return prepareResult(reports);
}
