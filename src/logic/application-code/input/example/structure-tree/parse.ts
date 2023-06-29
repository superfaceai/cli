import type {
  EnumDefinitionNode,
  ListDefinitionNode,
  ModelTypeNameNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  ObjectDefinitionNode,
  PrimitiveTypeNameNode,
  Type,
  UnionDefinitionNode,
} from '@superfaceai/ast';

import type {
  ExampleArray,
  ExampleObject,
  ExampleScalar,
  UseCaseExample,
} from '../usecase-example';

export function parse(
  type: Type,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): UseCaseExample {
  return visit(type, namedModelDefinitionsCache, namedFieldDefinitionsCache);
}

export function visit(
  node: Type,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): ExampleArray | ExampleObject | ExampleScalar {
  switch (node.kind) {
    case 'ObjectDefinition':
      return visitObjecDefinition(
        node,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );
    case 'PrimitiveTypeName':
      return visitPrimitiveNode(node);
    case 'ListDefinition':
      return visitListNode(
        node,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );
    case 'EnumDefinition':
      return visitEnumNode(node);
    case 'ModelTypeName': {
      return visitNamedModelNode(
        node,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );
    }
    case 'NonNullDefinition':
      return visit(
        node.type,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );
    case 'UnionDefinition':
      return visitUnionNode(
        node,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );
    default:
      throw new Error(`Invalid kind: ${node?.kind ?? 'undefined'}`);
  }
}

function visitNamedModelNode(
  node: ModelTypeNameNode,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): ExampleArray | ExampleObject | ExampleScalar {
  const foundNode = namedModelDefinitionsCache[node.name];
  if (foundNode.type === undefined) {
    throw new Error('Type not found');
  }

  return visit(
    foundNode.type,
    namedModelDefinitionsCache,
    namedFieldDefinitionsCache
  );
}

function visitUnionNode(
  node: UnionDefinitionNode,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): ExampleArray | ExampleObject | ExampleScalar {
  return visit(
    node.types[0],
    namedModelDefinitionsCache,
    namedFieldDefinitionsCache
  );
}

export function visitEnumNode(node: EnumDefinitionNode): ExampleScalar {
  if (typeof node.values[0].value === 'boolean') {
    return {
      kind: 'boolean',
      value: node.values[0].value,
    };
  }

  if (typeof node.values[0].value === 'number') {
    return {
      kind: 'number',
      value: node.values[0].value,
    };
  }

  return {
    kind: 'string',
    value: node.values[0].value,
  };
}

export function visitListNode(
  list: ListDefinitionNode,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): ExampleArray {
  return {
    kind: 'array',
    items: [
      visit(
        list.elementType,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
    ],
  };
}

export function visitPrimitiveNode(
  primitive: PrimitiveTypeNameNode
): ExampleScalar {
  if (primitive.name === 'boolean') {
    return {
      kind: 'boolean',
      value: true,
    };
  }

  if (primitive.name === 'number') {
    return {
      kind: 'number',
      value: 0,
    };
  }

  return {
    kind: 'string',
    value: '',
  };
}

export function visitObjecDefinition(
  object: ObjectDefinitionNode,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): ExampleObject {
  return {
    kind: 'object',
    properties: object.fields.map(field => {
      const namedFieldNode = namedFieldDefinitionsCache[field.fieldName];
      // Fallback to string if type is not defined
      const type = field.type ??
        namedFieldNode?.type ?? {
          kind: 'PrimitiveTypeName',
          name: 'string',
          location: field.location,
        };
      const model = visit(
        type,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );

      return {
        name: field.fieldName,
        ...model,
      };
    }),
  };
}
