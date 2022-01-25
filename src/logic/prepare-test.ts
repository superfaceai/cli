import {
  ComlinkListLiteralNode,
  ComlinkLiteralNode,
  ComlinkObjectLiteralNode,
  ComlinkPrimitiveLiteralNode,
  isUseCaseDefinitionNode,
  UseCaseExampleNode,
} from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import { ILogger } from '../common';
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
function indent(numberOfTabs: number): string {
  return '\t'.repeat(numberOfTabs);
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
  const items = input.items.map(item =>
    stringifyExampleNode(item, numberOfTabs + 1)
  );
  return `[${items.join(', ')}]`;
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
    value = stringifyExampleNode(field.value, numberOfTabs + 1);
    stringified += `\n${indent(numberOfTabs)}${field.key.join('.')}: ${value},`;
  }

  //Add newline only when input is not empty
  if (input.fields.length === 0) {
    return (stringified += '}');
  }

  return (stringified += `\n${indent(numberOfTabs - 1)}}`);
}

function stringifyExampleNode(
  node: ComlinkLiteralNode,
  numberOfTabs: number
): string {
  let stringified: string;

  if (node.kind === 'ComlinkObjectLiteral') {
    stringified = extractComlinkObjectLiteral(node, numberOfTabs);
  } else if (node.kind === 'ComlinkListLiteral') {
    stringified = extractComlinkListLiterallNode(node, numberOfTabs);
  } else {
    stringified = extractComlinkPrimitiveLiteralNode(node);
  }

  return stringified;
}

/**
 * Prepares ExampleInput object
 * @param input UseCaseExampleNode to be used as an input
 * @returns undefined if node does not contain any examples
 */
function prepareExampleInput(
  input: UseCaseExampleNode
): ExampleInput | undefined {
  if (input.input === undefined) {
    return undefined;
  }

  const NUMBER_OF_TABS = 6;

  return {
    exampleKind: input.error === undefined ? 'success' : 'error',
    input: stringifyExampleNode(input.input.value, NUMBER_OF_TABS),
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
  {
    superJson,
    profile,
    provider,
    path,
    fileName,
    version,
  }: {
    superJson: SuperJson;
    profile: ProfileId;
    provider: string;
    path?: string;
    fileName?: string;
    version?: string;
  },
  { logger }: { logger: ILogger }
): Promise<void> {
  const {
    ast: { definitions },
  } = await loadProfile({ superJson, profile, version }, { logger });
  const usecases = definitions.filter(isUseCaseDefinitionNode);
  const parameters: Record<string, ExampleInput[]> = {};

  for (const usecase of usecases) {
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
