import type {
  ComlinkListLiteralNode,
  ComlinkLiteralNode,
  ComlinkNoneLiteralNode,
  ComlinkObjectLiteralNode,
  ComlinkPrimitiveLiteralNode,
} from '@superfaceai/ast';

import type {
  ExampleArray,
  ExampleNone,
  ExampleObject,
  ExampleScalar,
  UseCaseExample,
} from '../usecase-example';

export function parseObjectLiteral(
  node: ComlinkObjectLiteralNode
): ExampleObject {
  const properties: ExampleObject['properties'] = [];
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
    } else if (field.value.kind === 'ComlinkNoneLiteral') {
      properties.push({
        name: field.key.join('.'),
        ...parseNoneLiteral(field.value),
      })
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

export function parseListLiteral(node: ComlinkListLiteralNode): ExampleArray {
  return {
    kind: 'array',
    items: node.items
      .map(parseLiteralExample)
      .filter((i): i is UseCaseExample => i !== undefined),
  };
}

export function parseNoneLiteral(_node: ComlinkNoneLiteralNode): ExampleNone {
  return {
    kind: 'none'
  };
}

export function parsePrimitiveLiteral(
  node: ComlinkPrimitiveLiteralNode
): ExampleScalar {
  if (typeof node.value === 'boolean') {
    return { kind: 'boolean', value: node.value };
  } else if (typeof node.value === 'number') {
    return { kind: 'number', value: node.value };
  }

  return { kind: 'string', value: node.value };
}

export function parseLiteralExample(
  exampleNode: ComlinkLiteralNode
): UseCaseExample | undefined {
  if (exampleNode === undefined) {
    return undefined;
  }
  if (exampleNode.kind === 'ComlinkObjectLiteral') {
    return parseObjectLiteral(exampleNode);
  } else if (exampleNode.kind === 'ComlinkListLiteral') {
    return parseListLiteral(exampleNode);
  } else if (exampleNode.kind === 'ComlinkNoneLiteral') {
    return parseNoneLiteral(exampleNode);
  } else {
    return parsePrimitiveLiteral(exampleNode);
  }
}
