import type { Model, ModelBase, ModelType } from './model-base';

export interface ListModel extends ModelBase {
  modelType: ModelType.LIST;
  elementModel: Model;
}
