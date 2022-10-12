import { EnumModel } from './enum.model';
import { ListModel } from './list.model';
import { ObjectModel } from './object.model';
import { ScalarModel } from './scalar.model';
import { UnionModel } from './union.model';

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
  name?: string; //available only for named models
  description?: string;
  modelType: ModelType; //model discriminator
}
