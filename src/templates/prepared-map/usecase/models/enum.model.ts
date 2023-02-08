import type { ModelBase, ModelType } from './model-base';

export interface EnumElement {
  title?: string;
  value: string | number | boolean;
}

export interface EnumModel extends ModelBase {
  modelType: ModelType.ENUM;
  enumElements: EnumElement[];
}
