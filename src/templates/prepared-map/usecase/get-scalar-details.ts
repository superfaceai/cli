import type { PrimitiveTypeNameNode } from '@superfaceai/ast';

import type { ScalarModel, ScalarType } from './models';
import { ModelType } from './models';

export function getScalarModelDetails(
  primitive: PrimitiveTypeNameNode,
  nonNull?: boolean
): ScalarModel {
  return {
    modelType: ModelType.SCALAR,
    nonNull: nonNull ?? false,
    scalarType: primitive.name as ScalarType,
  };
}
