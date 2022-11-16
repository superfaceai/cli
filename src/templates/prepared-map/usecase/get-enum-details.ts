import type { EnumDefinitionNode } from '@superfaceai/ast';

import type { EnumModel } from './models';
import { ModelType } from './models';

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
