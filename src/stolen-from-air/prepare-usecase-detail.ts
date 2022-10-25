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

import { buildUseCaseExamples } from './example/build';
import type { EnumModel } from './models/enum.model';
import type { ListModel } from './models/list.model';
import type { Model } from './models/model-base';
import { ModelType } from './models/model-base';
import type { ObjectModel } from './models/object.model';
import type { ScalarModel, ScalarType } from './models/scalar.model';
import type { UnionModel } from './models/union.model';
import type { UseCaseDetail } from './usecase-detail';

export function prepareUseCaseDetails(
  ast: ProfileDocumentNode
): UseCaseDetail[] {
  const namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  } = {};

  const namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  } = {};

  ast.definitions.forEach(definition => {
    if (definition.kind === 'NamedFieldDefinition') {
      namedFieldDefinitionsCache[definition.fieldName] = definition;
    } else if (definition.kind === 'NamedModelDefinition') {
      namedModelDefinitionsCache[definition.modelName] = definition;
    }
  });

  return ast.definitions
    .filter((definition): definition is UseCaseDefinitionNode => {
      return definition.kind === 'UseCaseDefinition';
    })
    .map(usecase => {
      const resolvedInputTree = getTypeDetails(
        usecase?.input?.value,
        undefined,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );

      const resolvedResultTree = getTypeDetails(
        usecase?.result?.value,
        undefined,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );

      const resolvedErrorTree = getTypeDetails(
        usecase?.error?.value,
        undefined,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );

      return {
        name: usecase.useCaseName,
        title: usecase?.documentation?.title,
        description: usecase?.documentation?.description,
        error: resolvedErrorTree,
        input: resolvedInputTree,
        result: resolvedResultTree,
        ...buildUseCaseExamples(ast, usecase.useCaseName),
      };
    });
}

export function getTypeDetails(
  astType: Type | undefined,
  nonNull: boolean | undefined,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): Model {
  if (astType === undefined) {
    return null;
  }
  switch (astType.kind) {
    case 'ObjectDefinition':
      return getObjectModelDetails(
        astType,
        nonNull,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );
    case 'PrimitiveTypeName':
      return getScalarModelDetails(astType, nonNull);
    case 'ListDefinition':
      return getListModelDetails(
        astType,
        nonNull,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );
    case 'EnumDefinition':
      return getEnumModelDetails(astType, nonNull);
    case 'ModelTypeName': {
      const node = namedModelDefinitionsCache[astType.name];

      return getTypeDetails(
        node.type,
        nonNull,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );
    }
    case 'NonNullDefinition':
      return getTypeDetails(
        astType.type,
        true,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );
    case 'UnionDefinition':
      return getUnionModelDetails(
        astType,
        nonNull,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      );
    default:
      return null;
  }
}

export function getScalarModelDetails(
  primitive: PrimitiveTypeNameNode,
  nonNull?: boolean
): ScalarModel {
  return {
    modelType: ModelType.SCALAR,
    nonNull,
    scalarType: primitive.name as ScalarType,
  } as ScalarModel;
}

export function getListModelDetails(
  list: ListDefinitionNode,
  nonNull: boolean | undefined,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): ListModel {
  return {
    modelType: ModelType.LIST,
    nonNull,
    model: getTypeDetails(
      list.elementType,
      undefined,
      namedModelDefinitionsCache,
      namedFieldDefinitionsCache
    ),
  } as ListModel;
}

export function getObjectModelDetails(
  object: ObjectDefinitionNode,
  nonNull: boolean | undefined,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): ObjectModel {
  return {
    modelType: ModelType.OBJECT,
    nonNull: nonNull ?? false,
    fields: object.fields
      .filter(item => item.kind === 'FieldDefinition')
      .map(field => {
        const namedFieldNode = namedModelDefinitionsCache[field.fieldName];

        const model = getTypeDetails(
          field.type ?? namedFieldNode?.type ?? undefined,
          undefined,
          namedModelDefinitionsCache,
          namedFieldDefinitionsCache
        );

        const description: string | undefined =
          field?.documentation?.title !== undefined
            ? field?.documentation?.description ?? field?.documentation?.title
            : namedFieldNode !== null
            ? namedFieldNode?.documentation?.description
            : undefined;

        return {
          fieldName: field.fieldName,
          required: field.required,
          nonNull: model?.nonNull,
          model: model,

          // If the field has an inline title provided, use the description
          // from inlined definition only (or fallback to title if not present).

          // E.g. Named field definition could contain both title & description
          //      while the inline definition only has a title. These 2 definitions
          //      could possibly have different meanings, mixing title from one
          //      with the description from the other is not desirable.
          description,
        };
      }),
  };
}

export function getEnumModelDetails(
  object: EnumDefinitionNode,
  nonNull?: boolean
): EnumModel {
  return {
    modelType: ModelType.ENUM,
    nonNull: nonNull ?? false,
    enumElements: object.values.map(({ value, documentation }) => ({
      value,
      title: documentation?.title,
    })),
  };
}

export function getUnionModelDetails(
  object: UnionDefinitionNode,
  nonNull: boolean | undefined,
  namedModelDefinitionsCache: {
    [key: string]: NamedModelDefinitionNode;
  },
  namedFieldDefinitionsCache: {
    [key: string]: NamedFieldDefinitionNode;
  }
): UnionModel {
  return {
    nonNull: nonNull ?? false,
    modelType: ModelType.UNION,
    types: object.types.map(t =>
      getTypeDetails(
        t,
        undefined,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      )
    ),
  };
}
