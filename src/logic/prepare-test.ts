import {
  ComlinkListLiteralNode,
  ComlinkObjectLiteralNode,
  ComlinkPrimitiveLiteralNode,
  isUseCaseDefinitionNode,
  UseCaseExampleNode,
} from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { LogCallback } from '..';
import { exists, mkdir } from '../common/io';
import { OutputStream } from '../common/output-stream';
import { ProfileId } from '../common/profile';
import { testTemplate } from '../templates/testTemplate';
import { loadProfile } from './publish.utils';

export type ExampleInput = {
  exampleKind: 'success' | 'error';
  input: string;
};

/**
 * Prepares string with number of \t according of passed parameter
 * @param numberOfTabs number of \t in created string
 * @returns
 */
function intend(numberOfTabs: number): string {
  let res = '';
  for (let i = 0; i < numberOfTabs; i++) {
    res += '\t';
  }

  return res;
}

/**
 * Extracts value of ComlinkPrimitiveLiteralNode to be used in string
 * @param input ComlinkPrimitiveLiteralNode
 * @returns stringified value of node
 */
function extractComlinkPrimitiveLiteralNode(
  input: ComlinkPrimitiveLiteralNode
): string {
  if (typeof input.value === 'string') {
    return `"${input.value}"`;
  }

  return input.value.toString();
}

/**
 * Extracts value of ComlinkListLiterallNode to be used in string
 * @param input ComlinkListLiterallNode
 * @param numberOfTabs number of \t in created string
 * @returns stringified value of node
 */
function extractComlinkListLiterallNode(
  input: ComlinkListLiteralNode,
  numberOfTabs: number
): string {
  const items = [];
  for (const item of input.items) {
    if (item.kind === 'ComlinkPrimitiveLiteral') {
      items.push(extractComlinkPrimitiveLiteralNode(item));
    } else if (item.kind === 'ComlinkObjectLiteral') {
      items.push(extractComlinkObjectLiteral(item, numberOfTabs + 1));
    } else {
      items.push(extractComlinkListLiterallNode(item, numberOfTabs + 1));
    }
  }

  return `[${items.join(',')}]`;
}
/**
 * Extracts value of ComlinkObjectLiteral to be used in string
 * @param input ComlinkObjectLiteral
 * @param numberOfTabs number of \t in created string
 * @returns stringified value of node
 */
function extractComlinkObjectLiteral(
  input: ComlinkObjectLiteralNode,
  numberOfTabs: number
): string {
  let stringified = '{';
  let value = '';
  for (const field of input.fields) {
    if (field.value.kind === 'ComlinkPrimitiveLiteral') {
      value = extractComlinkPrimitiveLiteralNode(field.value);
    } else if (field.value.kind === 'ComlinkListLiteral') {
      value = extractComlinkListLiterallNode(field.value, numberOfTabs + 1);
    } else {
      value = extractComlinkObjectLiteral(field.value, numberOfTabs + 1);
    }

    stringified += `\n${intend(numberOfTabs)}${field.key.join('.')}: ${value},`;
  }

  //Add newline only when input is not empty
  if (input.fields.length === 0) {
    return (stringified += `}`);
  }

  return (stringified += `\n${intend(numberOfTabs - 1)}}`);
}

/**
 * Prepares ExampleInput object
 * @param input UseCaseExampleNode to be used as an input
 * @returns undefined if node does not contain any examples
 */
function prepareExampleInput(
  input: UseCaseExampleNode
): ExampleInput | undefined {
  if (input.input === undefined || input.exampleName === undefined) {
    return undefined;
  }

  let stringified: string;

  if (input.input.value.kind === 'ComlinkObjectLiteral') {
    stringified = extractComlinkObjectLiteral(input.input.value, 6);
  } else if (input.input.value.kind === 'ComlinkListLiteral') {
    stringified = extractComlinkListLiterallNode(input.input.value, 6);
  } else {
    stringified = extractComlinkPrimitiveLiteralNode(input.input.value);
  }

  return {
    exampleKind: input.error === undefined ? 'success' : 'error',
    input: stringified,
  };
}

/**
 * Prepares test file fromn profile examples for specified profile and provider
 * @param superJson SuperJson defining used profile and provider
 * @param profile ProfileId of used profile
 * @param provider provider name
 * @param path optional path to test file
 * @param fileName optional name of test file
 * @param version optional version of used profile
 */
export async function prepareTest(
  superJson: SuperJson,
  profile: ProfileId,
  provider: string,
  path?: string,
  fileName?: string,
  version?: string,
  options?: {
    logCb?: LogCallback;
  }
): Promise<void> {
  const profileFiles = await loadProfile(superJson, profile, version, options);
  const parameters: Record<string, ExampleInput[]> = {};

  for (const usecase of profileFiles.ast.definitions) {
    if (isUseCaseDefinitionNode(usecase)) {
      const examples = usecase.examples || [];
      const exampleParams = [];
      for (const example of examples) {
        const parameter = prepareExampleInput(example.value);
        if (parameter !== undefined) {
          exampleParams.push(parameter);
        }
      }
      parameters[usecase.useCaseName] = exampleParams;
    }
  }

  const testFileContent = testTemplate(profile, provider, parameters);

  //Resolve file path
  const filePath = path || joinPath(process.cwd(), profile.id);
  if (!(await exists(filePath))) {
    await mkdir(filePath, { recursive: true });
  }

  //Resolve file nae
  const name = fileName || `${provider}.test.ts`;

  await OutputStream.writeOnce(joinPath(filePath, name), testFileContent);
}
