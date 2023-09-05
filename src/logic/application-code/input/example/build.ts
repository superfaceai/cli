import type {
  ComlinkLiteralNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  Type,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

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
  if (typeDefinition !== undefined) {
    return buildExampleFromAst(
      typeDefinition,
      namedModelDefinitionsCache,
      namedFieldDefinitionsCache,
      exampleLiteral
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
  errorExamples: {
    input?: UseCaseExample;
    error?: UseCaseExample;
  }[];
  successExamples: {
    input?: UseCaseExample;
    result?: UseCaseExample;
  }[];
} {
  const profileExamples = findUseCaseExamples(useCase);

  // Fall back to empty object when there are no examples in profile to ensure we get at least one example generated from type
  const profileErrorExamples =
    profileExamples.errorExamples !== undefined &&
    profileExamples.errorExamples.length > 0
      ? profileExamples.errorExamples
      : [{}];
  const profileSuccessExamples =
    profileExamples.successExamples !== undefined &&
    profileExamples.successExamples.length > 0
      ? profileExamples.successExamples
      : [{}];

  return {
    errorExamples: profileErrorExamples.map(example => ({
      input: extractExample(
        example?.input,
        useCase.input?.value,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
      error: extractExample(
        example?.error,
        useCase.error?.value,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
    })),
    successExamples: profileSuccessExamples.map(example => ({
      input: extractExample(
        example?.input,
        useCase.input?.value,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
      result: extractExample(
        example?.result,
        useCase.result?.value,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
    })),
  };
}

function findUseCaseExamples(usecase: UseCaseDefinitionNode): {
  errorExamples?: {
    input?: ComlinkLiteralNode;
    error?: ComlinkLiteralNode;
  }[];
  successExamples?: {
    input?: ComlinkLiteralNode;
    result?: ComlinkLiteralNode;
  }[];
} {
  const examples: {
    successExamples?: {
      input?: ComlinkLiteralNode;
      result?: ComlinkLiteralNode;
    }[];
    errorExamples?: {
      input?: ComlinkLiteralNode;
      error?: ComlinkLiteralNode;
    }[];
  } = { successExamples: undefined, errorExamples: undefined };

  if (usecase.examples === undefined || usecase.examples.length === 0)
    return examples;

  const exampleNodes = usecase.examples.filter(
    slot =>
      slot.kind === 'UseCaseSlotDefinition' &&
      slot.value.kind === 'UseCaseExample'
  );
  const successExampleNodes = exampleNodes
    .filter(example => example.value?.error === undefined)
    .map(e => e.value);

  const errorExampleNodes = exampleNodes
    .filter(example => Boolean(example.value?.error))
    .map(e => e.value);

  if (successExampleNodes.length !== 0) {
    examples.successExamples = successExampleNodes.map(node => ({
      input: node.input?.value,
      result: node.result?.value,
    }));
  }

  if (errorExampleNodes.length !== 0) {
    examples.errorExamples = errorExampleNodes.map(node => ({
      input: node.input?.value,
      error: node.error?.value,
    }));
  }

  return examples;
}
