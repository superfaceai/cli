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
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

import type {
  ExampleArray,
  ExampleObject,
  ExampleScalar,
  UseCaseExample,
} from './usecase-example';

export class ExampleBuilder {
  private namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  };

  private namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  };

  constructor(ast: ProfileDocumentNode) {
    this.namedFieldDefinitionsCache = {};
    this.namedModelDefinitionsCache = {};

    ast.definitions.forEach(definition => {
      if (definition.kind === 'NamedFieldDefinition') {
        this.namedFieldDefinitionsCache[definition.fieldName] = definition;
      } else if (definition.kind === 'NamedModelDefinition') {
        this.namedModelDefinitionsCache[definition.modelName] = definition;
      }
    });
  }

  private findNamedModelDefinition(
    modelName: string
  ): NamedModelDefinitionNode {
    return this.namedModelDefinitionsCache[modelName];
  }

  private findNamedFieldDefinition(
    fieldName: string
  ): NamedFieldDefinitionNode {
    return this.namedFieldDefinitionsCache[fieldName];
  }

  public visit(node: Type): ExampleArray | ExampleObject | ExampleScalar {
    switch (node.kind) {
      case 'ObjectDefinition':
        return this.visitObjecDefinition(node);
      case 'PrimitiveTypeName':
        return this.visitPrimitiveNode(node);
      case 'ListDefinition':
        return this.visitListNode(node);
      case 'EnumDefinition':
        return this.visitEnumNode(node);
      case 'ModelTypeName': {
        const foundNode = this.findNamedModelDefinition(node.name);
        if (foundNode.type === undefined) {
          throw new Error('Type not found');
        }

        return this.visit(foundNode.type);
      }
      case 'NonNullDefinition':
        return this.visit(node.type);
      case 'UnionDefinition':
        return this.visitUnionNode(node);
      default:
        throw new Error(`Invalid kind: ${node?.kind ?? 'undefined'}`);
    }
  }

  private visitUnionNode(
    node: UnionDefinitionNode
  ): ExampleArray | ExampleObject | ExampleScalar {
    return this.visit(node.types[0]);
  }

  private visitEnumNode(node: EnumDefinitionNode): ExampleScalar {
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

  private visitListNode(list: ListDefinitionNode): ExampleArray {
    return {
      kind: 'array',
      items: [this.visit(list.elementType)],
    };
  }

  private visitPrimitiveNode(primitive: PrimitiveTypeNameNode): ExampleScalar {
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

  private visitObjecDefinition(object: ObjectDefinitionNode): ExampleObject {
    return {
      kind: 'object',
      properties: object.fields.map(field => {
        const namedFieldNode = this.findNamedFieldDefinition(field.fieldName);
        const type = field.type ?? namedFieldNode?.type;
        if (type === undefined) {
          throw new Error('Type is undefined');
        }
        const model = this.visit(type);

        return {
          name: field.fieldName,
          ...model,
        };
      }),
    };
  }
}

export function buildUseCaseExample(
  ast: ProfileDocumentNode,
  usecaseName: string
): {
  errorExample: {
    input: UseCaseExample;
    error: UseCaseExample;
  };
  successExample?: {
    input?: UseCaseExample;
    result?: UseCaseExample;
  };
} {
  const builder: ExampleBuilder = new ExampleBuilder(ast);

  const u = ast.definitions
    .filter((d): d is UseCaseDefinitionNode => d.kind === 'UseCaseDefinition')
    .find(d => d.useCaseName === usecaseName);

  if (u === undefined) {
    throw new Error(`UseCase with name ${usecaseName} not found`);
  }

  const input =
    u.input !== undefined ? builder.visit(u.input.value) : undefined;
  const result =
    u.result !== undefined ? builder.visit(u.result.value) : undefined;
  const error =
    u.error !== undefined ? builder.visit(u.error.value) : undefined;

  return {
    errorExample: {
      input,
      error,
    },
    successExample: {
      input,
      result,
    },
  };
}
