import type {
  EnumDefinitionNode,
  ListDefinitionNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  ObjectDefinitionNode,
  PrimitiveTypeNameNode,
  ProfileDocumentNode,
  Type,
  UnionDefinitionNode,
} from '@superfaceai/ast';

import type {
  ExampleArray,
  ExampleObject,
  ExampleScalar,
  UseCaseExample,
} from '../usecase-example';

let namedModelDefinitionsCache: {
  [key: string]: NamedModelDefinitionNode;
};

let namedFieldDefinitionsCache: {
  [key: string]: NamedFieldDefinitionNode;
};

export function parse(ast: ProfileDocumentNode, type: Type): UseCaseExample {
  namedModelDefinitionsCache = {};
  namedFieldDefinitionsCache = {};

  ast.definitions.forEach(definition => {
    if (definition.kind === 'NamedFieldDefinition') {
      namedFieldDefinitionsCache[definition.fieldName] = definition;
    } else if (definition.kind === 'NamedModelDefinition') {
      namedModelDefinitionsCache[definition.modelName] = definition;
    }
  });

  return visit(type);
}

function findNamedModelDefinition(modelName: string): NamedModelDefinitionNode {
  return namedModelDefinitionsCache[modelName];
}

function findNamedFieldDefinition(fieldName: string): NamedFieldDefinitionNode {
  return namedFieldDefinitionsCache[fieldName];
}

export function visit(
  node: Type
): ExampleArray | ExampleObject | ExampleScalar {
  switch (node.kind) {
    case 'ObjectDefinition':
      return visitObjecDefinition(node);
    case 'PrimitiveTypeName':
      return visitPrimitiveNode(node);
    case 'ListDefinition':
      return visitListNode(node);
    case 'EnumDefinition':
      return visitEnumNode(node);
    case 'ModelTypeName': {
      const foundNode = findNamedModelDefinition(node.name);
      if (foundNode.type === undefined) {
        throw new Error('Type not found');
      }

      return visit(foundNode.type);
    }
    case 'NonNullDefinition':
      return visit(node.type);
    case 'UnionDefinition':
      return visitUnionNode(node);
    default:
      throw new Error(`Invalid kind: ${node?.kind ?? 'undefined'}`);
  }
}

function visitUnionNode(
  node: UnionDefinitionNode
): ExampleArray | ExampleObject | ExampleScalar {
  return visit(node.types[0]);
}

function visitEnumNode(node: EnumDefinitionNode): ExampleScalar {
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

function visitListNode(list: ListDefinitionNode): ExampleArray {
  return {
    kind: 'array',
    items: [visit(list.elementType)],
  };
}

function visitPrimitiveNode(primitive: PrimitiveTypeNameNode): ExampleScalar {
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

function visitObjecDefinition(object: ObjectDefinitionNode): ExampleObject {
  return {
    kind: 'object',
    properties: object.fields.map(field => {
      const namedFieldNode = findNamedFieldDefinition(field.fieldName);
      const type = field.type ?? namedFieldNode?.type;
      if (type === undefined) {
        throw new Error('Type is undefined');
      }
      const model = visit(type);

      return {
        name: field.fieldName,
        ...model,
      };
    }),
  };
}
