import type {
  ComlinkLiteralNode,
  ProfileDocumentNode,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

import { parseLiteralExample } from './example-tree';
import { parse as parseType } from './structure-tree';
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
  const useCase = ast.definitions
    .filter((d): d is UseCaseDefinitionNode => d.kind === 'UseCaseDefinition')
    .find(d => d.useCaseName === usecaseName);

  if (useCase === undefined) {
    throw new Error(
      `UseCase with name ${usecaseName} not found in use case definitions`
    );
  }

  let errorInput: UseCaseExample;
  let successInput: UseCaseExample;
  let error: UseCaseExample;
  let result: UseCaseExample;

  const examples = findUseCaseExample(useCase);

  if (examples.successExample?.input !== undefined) {
    successInput = parseLiteralExample(examples.successExample.input);
  } else {
    successInput =
      useCase.input !== undefined
        ? parseType(ast, useCase.input.value)
        : undefined;
  }

  if (examples.successExample?.result !== undefined) {
    result = parseLiteralExample(examples.successExample.result);
  } else {
    result =
      useCase.result !== undefined
        ? parseType(ast, useCase.result.value)
        : undefined;
  }

  if (examples.errorExample?.input !== undefined) {
    errorInput = parseLiteralExample(examples.errorExample.input);
  } else {
    errorInput =
      useCase.input !== undefined
        ? parseType(ast, useCase.input.value)
        : undefined;
  }

  if (examples.errorExample?.error !== undefined) {
    errorInput = parseLiteralExample(examples.errorExample.error);
  } else {
    error =
      useCase.error !== undefined
        ? parseType(ast, useCase.error.value)
        : undefined;
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

function findUseCaseExample(
  usecase: UseCaseDefinitionNode
): {
  errorExample?: {
    input?: ComlinkLiteralNode;
    error?: ComlinkLiteralNode;
  };
  successExample?: {
    input?: ComlinkLiteralNode;
    result?: ComlinkLiteralNode;
  };
} {
  let successExample = undefined;
  let errorExample = undefined;

  if (usecase.examples === undefined || usecase.examples.length === 0)
    return { successExample: undefined, errorExample: undefined };

  const exampleNodes = usecase.examples.filter(
    slot =>
      slot.kind === 'UseCaseSlotDefinition' &&
      slot.value.kind === 'UseCaseExample'
  );
  const successExampleNode = exampleNodes.find(example =>
    Boolean(example.value?.result)
  )?.value;

  const errorExampleNode = exampleNodes.find(example =>
    Boolean(example.value?.error)
  )?.value;

  if (successExampleNode !== undefined) {
    successExample = {
      input: successExampleNode.input?.value,
      result: successExampleNode.result?.value,
    };
  }

  if (errorExampleNode !== undefined) {
    errorExample = {
      input: errorExampleNode.input?.value,
      error: errorExampleNode.error?.value,
    };
  }

  return {
    successExample,
    errorExample,
  };
}
