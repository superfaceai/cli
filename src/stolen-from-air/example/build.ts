import type {
  ProfileDocumentNode,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

import { visit } from './example-tree';
import { ExampleBuilder } from './structure-tree';
import type { UseCaseExample } from './usecase-example';

export function buildUseCaseExamples(
  ast: ProfileDocumentNode,
  usecaseName: string
): {
  errorExample: {
    input?: UseCaseExample;
    error?: UseCaseExample;
  };
  successExample: {
    input?: UseCaseExample;
    result?: UseCaseExample;
  };
} {
  const u = ast.definitions
    .filter((d): d is UseCaseDefinitionNode => d.kind === 'UseCaseDefinition')
    .find(d => d.useCaseName === usecaseName);

  if (u === undefined) {
    throw new Error(`UseCase with name ${usecaseName} not found`);
  }

  let errorInput: UseCaseExample;
  let successInput: UseCaseExample;
  let error: UseCaseExample;
  let result: UseCaseExample;

  const exampleTree = visit(u);
  const builder: ExampleBuilder = new ExampleBuilder(ast);

  if (exampleTree.successExample?.input !== undefined) {
    successInput = exampleTree.successExample.input;
  } else {
    successInput =
      u.input !== undefined ? builder.visit(u.input.value) : undefined;
  }

  if (exampleTree.successExample?.result !== undefined) {
    result = exampleTree.successExample.result;
  } else {
    result = u.result !== undefined ? builder.visit(u.result.value) : undefined;
  }

  if (exampleTree.errorExample?.input !== undefined) {
    errorInput =
      u.input !== undefined ? builder.visit(u.input.value) : undefined;
  } else {
    error = u.error !== undefined ? builder.visit(u.error.value) : undefined;
  }

  return {
    errorExample: {
      input: errorInput,
      error,
    },
    successExample: {
      input: successInput,
      result,
    },
  };
}
