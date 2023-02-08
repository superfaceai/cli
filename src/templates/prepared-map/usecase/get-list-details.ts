import type {
  ListDefinitionNode,
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
} from '@superfaceai/ast';

import { getTypeDetails } from './get-type-details';
import type { ListModel } from './models';
import { ModelType } from './models';

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
    nonNull: nonNull ?? false,
    model: getTypeDetails(
      list.elementType ?? undefined,
      undefined,
      namedModelDefinitionsCache,
      namedFieldDefinitionsCache
    ),
  };
}
