import type {
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  ProfileDocumentNode,
  Type,
  UseCaseDefinitionNode,
} from '@superfaceai/ast';

import { buildUseCaseExamples } from './example/build';
import { getEnumModelDetails } from './get-enum-details';
import { getListModelDetails } from './get-list-details';
import { getObjectModelDetails } from './get-object-details';
import { getScalarModelDetails } from './get-scalar-details';
import { getUnionModelDetails } from './get-union-details';
import type { Model } from './models/model-base';
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
    .map(usecase => ({
      name: usecase.useCaseName,
      title: usecase?.documentation?.title,
      description: usecase?.documentation?.description,
      error: getTypeDetails(
        usecase?.error?.value,
        undefined,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
      input: getTypeDetails(
        usecase?.input?.value,
        undefined,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
      result: getTypeDetails(
        usecase?.result?.value,
        undefined,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      ),
      ...buildUseCaseExamples(ast, usecase.useCaseName),
    }));
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
