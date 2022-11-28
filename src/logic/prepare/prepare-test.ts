import type {
  ComlinkListLiteralNode,
  ComlinkLiteralNode,
  ComlinkObjectLiteralNode,
  ComlinkPrimitiveLiteralNode,
  SuperJsonDocument,
  UseCaseExampleNode,
} from '@superfaceai/ast';
import { isUseCaseDefinitionNode } from '@superfaceai/ast';
import console from 'console';
import { inspect } from 'util';

import type { ILogger } from '../../common';
import { OutputStream } from '../../common/output-stream';
import type { ProfileId } from '../../common/profile';
import { prepareUseCaseDetails } from '../../templates/prepared-map/usecase';
import { prepareTestTemplate } from '../../templates/prepared-test/prepare-test';
import { loadProfile } from '../publish.utils';

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

  // Add newline only when input is not empty
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

  const NUMBER_OF_TABS = 5;

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
    superJsonPath,
    profile,
    provider,
    version,
    options,
  }: {
    superJson: SuperJsonDocument;
    superJsonPath: string;
    profile: ProfileId;
    provider: string;
    version?: string;
    options: {
      force?: boolean;
      station?: boolean;
    };
  },
  { logger }: { logger: ILogger }
): Promise<void> {
  const { ast } = await loadProfile(
    { superJson, superJsonPath, profile, version },
    { logger }
  );

  const s = prepareUseCaseDetails(ast);

  console.log('s', inspect(s, true, 20));

  const usecases = ast.definitions.filter(isUseCaseDefinitionNode);
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

  const testFileContent = prepareTestTemplate(ast, provider);

  let filePath: string;

  if (options?.station === true) {
    filePath = `grid/${profile.id}/maps/${provider}.test.ts`;
  } else {
    filePath = `${profile.id}/${provider}.test.ts`;
  }

  await OutputStream.writeOnce(filePath, testFileContent, {
    dirs: true,
    force: options.force,
  });
}
