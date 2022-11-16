import type { Model } from './model-base';

export interface Field<T extends Model> {
  description?: string;
  fieldName: string;
  required: boolean;
  nullable?: boolean;
  model: T;
}
