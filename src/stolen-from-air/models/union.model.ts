import { ModelBase, ModelType, Model } from './model-base';

export interface UnionModel extends ModelBase {
  modelType: ModelType.UNION;
  types: Model[];
}
