import type { Model, ModelBase, ModelType } from './model-base';

export interface UnionModel extends ModelBase {
  modelType: ModelType.UNION;
  types: Model[];
}
