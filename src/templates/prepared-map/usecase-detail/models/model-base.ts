import type { EnumModel } from './enum.model';
import type { ListModel } from './list.model';
import type { ObjectModel } from './object.model';
import type { ScalarModel } from './scalar.model';
import type { UnionModel } from './union.model';

export enum ModelType {
  OBJECT = 'Object',
  LIST = 'List',
  ENUM = 'Enum',
  UNION = 'Union',
  SCALAR = 'Scalar',
}

export type Model =
  | ObjectModel
  | ScalarModel
  | EnumModel
  | ListModel
  | UnionModel
  | null;

export interface ModelBase {
  name?: string; // available only for named models
  description?: string;
  nonNull: boolean;
  modelType: ModelType; // model discriminator
}
