import type {
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  Type,
} from '@superfaceai/ast';

import { getEnumModelDetails } from './get-enum-details';
import { getListModelDetails } from './get-list-details';
import { getObjectModelDetails } from './get-object-details';
import { getScalarModelDetails } from './get-scalar-details';
import { getUnionModelDetails } from './get-union-details';
import type { Model } from './models';

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
