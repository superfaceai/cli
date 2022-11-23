import type { ProfileDocumentNode, SuperJsonDocument } from '@superfaceai/ast';
import { getProfileOutput } from '@superfaceai/parser';
import { dirname, join as joinPath, resolve as resolvePath } from 'path';
import type { CompilerOptions } from 'typescript';
import {
  createProgram,
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
} from 'typescript';

import { UNCOMPILED_SDK_FILE } from '../common/document';
import { rimraf } from '../common/io';
import type { ILogger } from '../common/log';
import { OutputStream } from '../common/output-stream';
import type { ProfileId } from '../common/profile';
import {
  camelize,
  createProfileType,
  createSource,
  createUsecaseTypes,
  namedImport,
  pascalize,
  reexport,
  typedClientStatement,
  typeDefinitions,
} from './generate.utils';
import { loadProfile } from './publish/publish.utils';

export async function generate(
  {
    profiles,
    superJson,
    superJsonPath,
  }: {
    profiles: { id: ProfileId; version?: string }[];
    superJson: SuperJsonDocument;
    superJsonPath: string;
  },
  { logger }: { logger: ILogger }
): Promise<void> {
  const sources: Record<string, string> = {};
  for (const profile of profiles) {
    const loadedProfile = await loadProfile(
      {
        superJson,
        superJsonPath,
        profile: profile.id,
        version: profile.version,
      },
      { logger }
    );
    const typing = generateTypingsForProfile(loadedProfile.ast);
    sources[joinPath('types', profile.id.id + '.ts')] = typing;
  }

  const sdkFile = generateTypesFile(profiles.map(profile => profile.id.id));
  sources[UNCOMPILED_SDK_FILE] = sdkFile;
  await transpileFiles(sources, superJsonPath);
}
/**
 * Generates sdk.ts file from supplied profiles
 * If typesFile is already present, it is updated
 */
export function generateTypesFile(profiles: string[]): string {
  const imports = profiles.flatMap(profile => [
    namedImport([camelize(profile)], './types/' + profile),
    reexport([pascalize(profile) + 'Profile'], './types/' + profile),
  ]);
  const statements = [
    namedImport(['createTypedClient'], '@superfaceai/one-sdk'),
    ...imports,
    ...typeDefinitions(profiles),
    ...typedClientStatement(),
  ];

  const source = createSource(statements);

  return source;
}

/**
 * Generates typings file for a single profile
 */
export function generateTypingsForProfile(
  profileAST: ProfileDocumentNode
): string {
  const profileName =
    profileAST.header.scope !== undefined
      ? `${profileAST.header.scope}/${profileAST.header.name}`
      : profileAST.header.name;
  const output = getProfileOutput(profileAST);
  const inputTypes = output.usecases.flatMap(usecase =>
    createUsecaseTypes(profileName, usecase, 'unknown')
  );

  const statements = [
    namedImport(['typeHelper', 'TypedProfile'], '@superfaceai/one-sdk'),
    ...inputTypes,
    ...createProfileType(
      profileName,
      output.usecases.map(usecase => ({
        name: usecase.useCaseName,
        doc: {
          title: usecase.title,
          description: usecase.description,
        },
      }))
    ),
  ];

  return createSource(statements);
}

/**
 * Transpiles provided files to .js and .d.ts
 */
export async function transpileFiles(
  sources: Record<string, string>,
  superJsonPath: string
): Promise<void> {
  const options: CompilerOptions = {
    declaration: true,
    module: ModuleKind.CommonJS,
    moduleResolution: ModuleResolutionKind.NodeJs,
    target: ScriptTarget.ES5,
    allowJs: true,
  };
  for (const [path, data] of Object.entries(sources)) {
    await OutputStream.writeOnce(
      resolvePath(dirname(superJsonPath), path),
      data,
      {
        dirs: true,
      }
    );
  }
  const program = createProgram(
    [resolvePath(dirname(superJsonPath), UNCOMPILED_SDK_FILE)],
    options
  );
  program.emit();

  for (const path of Object.keys(sources)) {
    await rimraf(resolvePath(dirname(superJsonPath), path));
  }
}
