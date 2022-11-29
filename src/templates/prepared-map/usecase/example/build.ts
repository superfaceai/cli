import type {
  ComlinkLiteralNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  Type,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

import { parseLiteralExample } from './example-tree';
import { parse as buildExampleFromAst } from './structure-tree';
import type { UseCaseExample } from './usecase-example';

function extractExample(
  exampleLiteral: ComlinkLiteralNode | undefined,
  typeDefinition: Type | undefined,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): UseCaseExample | undefined {
  if (exampleLiteral !== undefined) {
    return parseLiteralExample(exampleLiteral);
  }
  if (typeDefinition !== undefined) {
    return buildExampleFromAst(
      typeDefinition,
      namedModelDefinitionsCache,
      namedFieldDefinitionsCache
    );
  }
  
return undefined;
}

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
  const examples = findUseCaseExamples(useCase);

  return {
    errorExample: {
      input: extractExample(
        examples.errorExample?.input,
        useCase.input?.value,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
      error: extractExample(
        examples.errorExample?.error,
        useCase.error?.value,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
    },
    successExample: {
      input: extractExample(
        examples.successExample?.input,
        useCase.input?.value,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
      result: extractExample(
        examples.successExample?.result,
        useCase.result?.value,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
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
