import type {
  NamedFieldDefinitionNode,
  NamedModelDefinitionNode,
  UnionDefinitionNode,
} from '@superfaceai/ast';

import { getTypeDetails } from './get-type-details';
import type { UnionModel } from './models';
import { ModelType } from './models';

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
        false,
        namedModelDefinitionsCache,
        namedFieldDefinitionsCache
      )
    ),
  };
}
