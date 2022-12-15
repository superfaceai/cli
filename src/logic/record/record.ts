import type {
  MapDocumentNode,
  NormalizedSuperJsonDocument,
  SetStatementNode,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';
import type { ILogger as SdkLogger, LogFunction } from '@superfaceai/one-sdk';
import { castToNonPrimitive, DEFAULT_CACHE_PATH } from '@superfaceai/one-sdk';
import type { LocationSpan } from '@superfaceai/parser';
import { dirname, join as joinPath } from 'path';
import { inspect } from 'util';

import type { ILogger } from '../../common';
import type { UserError } from '../../common/error';
import { mkdir } from '../../common/io';
import { OutputStream } from '../../common/output-stream';
import type { ProfileId } from '../../common/profile';
import { loadMap, loadProfile, loadProvider } from '../publish.utils';
import { createBoundProfileProvider } from './create-bound-profile-provider';
import { prepareExampleInput } from './prepare-example-input';

export async function record(
  {
    superJson,
    superJsonPath,
    profile,
    provider,
    map,
    version,
    useCaseName,
  }: {
    superJson: NormalizedSuperJsonDocument;
    superJsonPath: string;
    profile: ProfileId;
    provider: string;
    map: {
      variant?: string;
    };
    version?: string;
    useCaseName: string;
  },
  { logger, userError }: { logger: ILogger; userError: UserError }
) {
  // Profile
  const profileFiles = await loadProfile(
    { superJson, superJsonPath, profile, version },
    { logger }
  );
  if (profileFiles.from.kind !== 'local') {
    throw userError(
      `Profile: "${profile.id}" not found on local file system`,
      1
    );
  }

  const useCase = profileFiles.ast.definitions
    .filter((d): d is UseCaseDefinitionNode => d.kind === 'UseCaseDefinition')
    .find(u => u.useCaseName === useCaseName);

  if (useCase === undefined) {
    throw userError(`Use case: "${useCaseName}" not found in profile`, 1);
  }

  const example = prepareExampleInput(useCase);

  // Map
  const mapFiles = await loadMap(
    { superJson, superJsonPath, profile, provider, map, version },
    { logger }
  );
  if (mapFiles.from.kind !== 'local') {
    throw userError(
      `Map for profile: "${profile.id}" and provider: "${provider}" not found on local filesystem`,
      1
    );
  }

  // Provider
  const providerFiles = await loadProvider(superJson, superJsonPath, provider, {
    logger,
  });

  if (providerFiles.from.kind === 'remote') {
    throw userError(
      `Provider: "${provider}" not found on local file system`,
      1
    );
  }

  // HACK inject our debug int AST
  const { injected, locations } = inject(mapFiles.ast);

  const extractor = new MockLogger();
  const b = createBoundProfileProvider({
    superJson,
    profileAst: profileFiles.ast,
    mapAst: injected,
    providerJson: providerFiles.source,
    options: {
      logger: extractor,
    },
  });

  const result = await b.perform(
    useCase.useCaseName,
    castToNonPrimitive(example)
  );

  const value: unknown = result.unwrap();

  const trace: Record<string, { body: unknown; location?: LocationSpan }> = {};
  for (const [url, location] of Object.entries(locations)) {
    trace[url] = {
      location,
      body: extractor.output[url],
    };
  }

  console.log('trace', inspect(trace, true, 20));

  console.log('value', value);

  const cachePath = DEFAULT_CACHE_PATH({
    // eslint-disable-next-line @typescript-eslint/unbound-method
    path: { join: joinPath, cwd: process.cwd },
  });

  const path = joinPath(cachePath, 'records.json');

  console.log('path', path);

  await mkdir(dirname(path), { recursive: true });

  await OutputStream.writeOnce(
    path,
    JSON.stringify({ [`${profile.id}.${provider}`]: trace }, undefined, 2),
    { force: true }
  );
}

function inject(ast: MapDocumentNode): {
  injected: MapDocumentNode;
  locations: Record<string, LocationSpan | undefined>;
} {
  const locations: Record<string, LocationSpan | undefined> = {};

  const debugStatement = (id: string): SetStatementNode => ({
    kind: 'SetStatement',
    assignments: [
      {
        kind: 'Assignment',
        key: ['tmp'],
        value: {
          kind: 'JessieExpression',
          expression: `std.unstable.debug.log("${id}", body)`,
          source: `std.unstable.debug.log("${id}", body)`,
          sourceMap:
            'AAAA,IAAI,aAAa,GAAG,GAAG,CAAC,QAAQ,CAAC,KAAK,CAAC,GAAG,CAAC,MAAM,EAAE,IAAI,CAAC,CAAC',
        },
      },
    ],
  });

  for (const def of ast.definitions) {
    if (def.kind === 'MapDefinition') {
      for (const s of def.statements) {
        if (s.kind === 'HttpCallStatement') {
          locations[s.url] = s.location;
          for (const handler of s.responseHandlers) {
            handler.statements = [debugStatement(s.url), ...handler.statements];
          }
        }
      }
    }
  }

  return {
    injected: ast,
    locations,
  };
}

class MockLogger implements SdkLogger {
  public output: Record<string, unknown> = {};

  public log(name: string): LogFunction;
  public log(name: string, format: string, ...args: unknown[]): void;
  public log(
    name: string,
    format?: string,
    ...args: unknown[]
  ): void | LogFunction {
    const instance: LogFunction = (format: string, ...args: unknown[]) => {
      if (name === 'debug-log') this.output[format] = args;
    };

    instance.enabled = true;

    if (format === undefined) {
      return instance;
    }

    instance(format, ...args);
  }
}
