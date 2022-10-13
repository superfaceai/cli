import type { Field } from '../field';
import type { Model, ModelBase, ModelType } from './model-base';

export interface ObjectModel extends ModelBase {
  modelType: ModelType.OBJECT;
  fields: Field<Model>[];
}
