import type {
  ComlinkLiteralNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

import { parseLiteralExample } from './example-tree';
import { parse as buildExampleFromAst } from './structure-tree';
import type { UseCaseExample } from './usecase-example';

export function buildUseCaseExamples(
  useCase: UseCaseDefinitionNode,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
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
  let errorInput: UseCaseExample | undefined;
  let successInput: UseCaseExample | undefined;
  let error: UseCaseExample | undefined;
  let result: UseCaseExample | undefined;

  const examples = findUseCaseExamples(useCase);

  if (examples.successExample?.input !== undefined) {
    successInput = parseLiteralExample(examples.successExample.input);
  } else {
    successInput =
      useCase.input !== undefined
        ? buildExampleFromAst(
            useCase.input.value,
            namedModelDefinitionsCache,
            namedFieldDefinitionsCache
          )
        : undefined;
  }

  if (examples.successExample?.result !== undefined) {
    result = parseLiteralExample(examples.successExample.result);
  } else {
    result =
      useCase.result !== undefined
        ? buildExampleFromAst(
            useCase.result.value,
            namedModelDefinitionsCache,
            namedFieldDefinitionsCache
          )
        : undefined;
  }

  if (examples.errorExample?.input !== undefined) {
    errorInput = parseLiteralExample(examples.errorExample.input);
  } else {
    errorInput =
      useCase.input !== undefined
        ? buildExampleFromAst(
            useCase.input.value,
            namedModelDefinitionsCache,
            namedFieldDefinitionsCache
          )
        : undefined;
  }

  if (examples.errorExample?.error !== undefined) {
    errorInput = parseLiteralExample(examples.errorExample.error);
  } else {
    error =
      useCase.error !== undefined
        ? buildExampleFromAst(
            useCase.error.value,
            namedModelDefinitionsCache,
            namedFieldDefinitionsCache
          )
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

function findUseCaseExamples(usecase: UseCaseDefinitionNode): {
  errorExample?: {
    input?: ComlinkLiteralNode;
    error?: ComlinkLiteralNode;
  };
  successExample?: {
    input?: ComlinkLiteralNode;
    result?: ComlinkLiteralNode;
  };
} {
  const examples: {
    successExample?: {
      input?: ComlinkLiteralNode;
      result?: ComlinkLiteralNode;
    };
    errorExample?: { input?: ComlinkLiteralNode; error?: ComlinkLiteralNode };
  } = { successExample: undefined, errorExample: undefined };

  if (usecase.examples === undefined || usecase.examples.length === 0)
    return examples;

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
    examples.successExample = {
      input: successExampleNode.input?.value,
      result: successExampleNode.result?.value,
    };
  }

  if (errorExampleNode !== undefined) {
    examples.errorExample = {
      input: errorExampleNode.input?.value,
      error: errorExampleNode.error?.value,
    };
  }

  return examples;
}
