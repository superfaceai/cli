import { ProfileDocumentNode } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { getProfileOutput } from '@superfaceai/parser';
import { join as joinPath } from 'path';
import {
  CompilerOptions,
  // createCompilerHost,
  createProgram,
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
} from 'typescript';

import { UNCOMPILED_SDK_FILE } from '../common/document';
import { rimraf } from '../common/io';
import { LogCallback } from '../common/log';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
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
import { loadProfile } from './publish.utils';

export async function generate(
  profiles: { id: ProfileId; version?: string }[],
  superJson: SuperJson,
  options?: { logCb?: LogCallback; warnCb?: LogCallback }
): Promise<void> {
  const sources: Record<string, string> = {};
  for (const profile of profiles) {
    const loadedProfile = await loadProfile(
      superJson,
      profile.id,
      profile.version,
      options
    );
    const typing = generateTypingsForProfile(loadedProfile.ast);
    sources[joinPath('types', profile.id.id + '.ts')] = typing;
  }

  const sdkFile = generateTypesFile(profiles.map(profile => profile.id.id));
  sources[UNCOMPILED_SDK_FILE] = sdkFile;
  await transpileFiles(sources, superJson);
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
        doc: { title: usecase.title, description: usecase.description },
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
  superJson: SuperJson
): Promise<void> {
  const options: CompilerOptions = {
    declaration: true,
    module: ModuleKind.CommonJS,
    moduleResolution: ModuleResolutionKind.NodeJs,
    target: ScriptTarget.ES5,
    allowJs: true,
  };
  for (const [path, data] of Object.entries(sources)) {
    await OutputStream.writeOnce(superJson.resolvePath(path), data, {
      dirs: true,
    });
  }
  const program = createProgram(
    [superJson.resolvePath(UNCOMPILED_SDK_FILE)],
    options
  );
  program.emit();

  for (const path of Object.keys(sources)) {
    await rimraf(superJson.resolvePath(path));
  }
}
