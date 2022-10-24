import type {
  ComlinkListLiteralNode,
  ComlinkLiteralNode,
  ComlinkObjectLiteralNode,
  ComlinkPrimitiveLiteralNode,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

import type {
  ExampleArray,
  ExampleObject,
  ExampleScalar,
  UseCaseExample,
} from './usecase-example';

export function buildUseCaseExamples(
  usecase: UseCaseDefinitionNode
): {
  errorExample?: {
    input?: UseCaseExample;
    error?: UseCaseExample;
  };
  successExample?: {
    input?: UseCaseExample;
    result?: UseCaseExample;
  };
} {
  const errorExample: {
    input?: UseCaseExample;
    error?: UseCaseExample;
  } = {};
  const successExample: {
    input?: UseCaseExample;
    result?: UseCaseExample;
  } = {};

  const examples = findUseCaseExample(usecase);
  const successExampleNode = examples.successExample;
  const errorExampleNode = examples.errorExample;

  if (successExampleNode?.input !== undefined) {
    successExample.input = parseLiteralExample(successExampleNode.input);
  }

  if (successExampleNode?.result !== undefined) {
    successExample.result = parseLiteralExample(successExampleNode?.result);
  }

  if (errorExampleNode?.input !== undefined) {
    errorExample.input = parseLiteralExample(errorExampleNode.input);
  }

  if (errorExampleNode?.error !== undefined) {
    errorExample.error = parseLiteralExample(errorExampleNode?.error);
  }

  //TODO: build examples from original structure
  return { successExample, errorExample };
}

function parseObjectLiteral(node: ComlinkObjectLiteralNode): ExampleObject {
  const properties: ({ name: string } & (
    | ExampleArray
    | ExampleScalar
    | ExampleObject
  ))[] = [];
  for (const field of node.fields) {
    if (field.value.kind === 'ComlinkPrimitiveLiteral') {
      properties.push({
        name: field.key.join('.'),
        ...parsePrimitiveLiteral(field.value),
      });
    } else if (field.value.kind === 'ComlinkListLiteral') {
      properties.push({
        name: field.key.join('.'),
        ...parseListLiteral(field.value),
      });
    } else {
      properties.push({
        name: field.key.join('.'),
        ...parseObjectLiteral(field.value),
      });
    }
  }

  return {
    kind: 'object',
    properties,
  };
}

function parseListLiteral(node: ComlinkListLiteralNode): ExampleArray {
  const items: (ExampleArray | ExampleObject | ExampleScalar)[] = [];

  for (const item of node.items) {
    if (item.kind === 'ComlinkPrimitiveLiteral') {
      items.push(parsePrimitiveLiteral(item));
    } else if (item.kind === 'ComlinkListLiteral') {
      items.push(parseListLiteral(node));
    } else {
      items.push(parseObjectLiteral(item));
    }
  }

  return {
    kind: 'array',
    items,
  };
}

function parsePrimitiveLiteral(
  node: ComlinkPrimitiveLiteralNode
): ExampleScalar {
  if (typeof node.value === 'boolean') {
    return { kind: 'boolean', value: node.value };
  } else if (typeof node.value === 'number') {
    return { kind: 'number', value: node.value };
  }

  return { kind: 'string', value: node.value };
}

function parseLiteralExample(exampleNode?: ComlinkLiteralNode): UseCaseExample {
  if (exampleNode === undefined) {
    return undefined;
  }
  switch (exampleNode?.kind) {
    case 'ComlinkObjectLiteral': {
      return parseObjectLiteral(exampleNode);
    }
    case 'ComlinkListLiteral': {
      return parseListLiteral(exampleNode);
    }
    case 'ComlinkPrimitiveLiteral':
      return parsePrimitiveLiteral(exampleNode);
    default:
      throw new Error('unknown type');
  }
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
