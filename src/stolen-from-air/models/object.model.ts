import { Field } from '../field';
import { Model, ModelBase, ModelType } from './model-base';

export interface ObjectModel extends ModelBase {
  modelType: ModelType.OBJECT;
  fields: Field<Model>[];
}
