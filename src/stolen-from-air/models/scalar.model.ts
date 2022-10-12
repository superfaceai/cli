import { ModelBase, ModelType } from './model-base';

export enum ScalarType {
  BOOLEAN = 'boolean',
  STRING = 'string',
  NUMBER = 'number',
}

export interface ScalarModel extends ModelBase {
  modelType: ModelType.SCALAR;
  scalarType: ScalarType;
}
