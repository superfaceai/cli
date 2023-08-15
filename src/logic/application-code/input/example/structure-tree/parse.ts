import type {
  ComlinkListLiteralNode,
  ComlinkLiteralNode,
  ComlinkObjectLiteralNode,
  ComlinkPrimitiveLiteralNode,
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
  },
  example?: ComlinkLiteralNode
): UseCaseExample {
  return visit(
    type,
    namedModelDefinitionsCache,
    namedFieldDefinitionsCache,
    false,
    example
  );
}

export function visit(
  node: Type,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  },
  required: boolean,
  example?: ComlinkLiteralNode
): ExampleArray | ExampleObject | ExampleScalar {
  switch (node.kind) {
    case 'ObjectDefinition':
      return visitObjecDefinition(
        node,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache,
        example?.kind === 'ComlinkObjectLiteral' ? example : undefined
      );
    case 'PrimitiveTypeName':
      return visitPrimitiveNode(
        node,
        required,
        example?.kind === 'ComlinkPrimitiveLiteral' ? example : undefined
      );
    case 'ListDefinition':
      return visitListNode(
        node,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache,
        required,
        example?.kind === 'ComlinkListLiteral' ? example : undefined
      );
    case 'EnumDefinition':
      return visitEnumNode(
        node,
        required,
        example?.kind === 'ComlinkPrimitiveLiteral' ? example : undefined
      );
    case 'ModelTypeName': {
      return visitNamedModelNode(
        node,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache,
        example
      );
    }
    case 'NonNullDefinition':
      return visit(
        node.type,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache,
        required,
        example
      );
    case 'UnionDefinition':
      return visitUnionNode(
        node,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache,
        required
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
  },
  example?: ComlinkLiteralNode
): ExampleArray | ExampleObject | ExampleScalar {
  const foundNode = namedModelDefinitionsCache[node.name];
  if (foundNode.type === undefined) {
    throw new Error('Type not found');
  }

  return visit(
    foundNode.type,
    namedModelDefinitionsCache,
    namedFieldDefinitionsCache,
    false,
    example
  );
}

function visitUnionNode(
  node: UnionDefinitionNode,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  },
  required: boolean,
  example?: ComlinkLiteralNode
): ExampleArray | ExampleObject | ExampleScalar {
  return visit(
    node.types[0],
    namedModelDefinitionsCache,
    namedFieldDefinitionsCache,
    required,
    example
  );
}

export function visitEnumNode(
  node: EnumDefinitionNode,
  required: boolean,
  example?: ComlinkPrimitiveLiteralNode
): ExampleScalar {
  if (typeof node.values[0].value === 'boolean') {
    return {
      kind: 'boolean',
      value:
        typeof example?.value === 'boolean'
          ? example.value
          : node.values[0].value,
      required,
    };
  }

  if (typeof node.values[0].value === 'number') {
    return {
      kind: 'number',
      value:
        typeof example?.value === 'number'
          ? example.value
          : node.values[0].value,
      required,
    };
  }

  return {
    kind: 'string',
    value:
      typeof example?.value === 'string' ? example.value : node.values[0].value,
    required,
  };
}

export function visitListNode(
  list: ListDefinitionNode,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  },
  required: boolean,
  example?: ComlinkListLiteralNode
): ExampleArray {
  if (example?.kind === 'ComlinkListLiteral') {
    return {
      kind: 'array',
      items: example.items.map(item =>
        visit(
          list.elementType,
          namedModelDefinitionsCache,
          namedFieldDefinitionsCache,
          required,
          item
        )
      ),
    };
  }

  return {
    kind: 'array',
    items: [
      visit(
        list.elementType,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache,
        required,
        undefined
      ),
    ],
  };
}

export function visitPrimitiveNode(
  primitive: PrimitiveTypeNameNode,
  required: boolean,
  example?: ComlinkPrimitiveLiteralNode
): ExampleScalar {
  if (primitive.name === 'boolean') {
    return {
      kind: 'boolean',
      value: typeof example?.value === 'boolean' ? example.value : true,
      required,
    };
  }

  if (primitive.name === 'number') {
    return {
      kind: 'number',
      value: typeof example?.value === 'number' ? example.value : 0,
      required,
    };
  }

  return {
    kind: 'string',
    value: typeof example?.value === 'string' ? example.value : '',
    required,
  };
}

export function visitObjecDefinition(
  object: ObjectDefinitionNode,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  },
  example?: ComlinkObjectLiteralNode
): ExampleObject {
  return {
    kind: 'object',
    properties: object.fields.map(field => {
      console.log('field', field);
      const namedFieldNode = namedFieldDefinitionsCache[field.fieldName];
      // const namedModelNode = namedModelDefinitionsCache[field.fieldName];
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
        namedFieldDefinitionsCache,
        field.required,
        example?.kind === 'ComlinkObjectLiteral'
          ? example.fields.find(prop => prop.key.join('') === field.fieldName)
              ?.value
          : undefined
      );

      return {
        name: field.fieldName,
        ...model,
      };
    }),
  };
}
