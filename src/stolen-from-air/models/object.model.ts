import type { Field } from './field.model';
import type { Model, ModelBase, ModelType } from './model-base';

export interface ObjectModel extends ModelBase {
  modelType: ModelType.OBJECT;
  fields: Field<Model>[];
}
