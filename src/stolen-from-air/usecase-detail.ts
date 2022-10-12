import { UseCaseBase } from './usecase-base';
import { UseCaseSlotExample } from './usecase-example';

type Field = {
  fieldName: string;
  type?: 'string' | 'number' | 'boolean' | 'enum';
  typeValues?: (string | number | boolean)[];
  description?: string;
  required: boolean;
};

export type UseCaseSlot = {
  title: string;
  fields?: Field[];
};

/** Use case details */
export interface UseCaseDetail extends UseCaseBase {
  input?: UseCaseSlot;
  result?: UseCaseSlot;
  error?: UseCaseSlot;
  errorExample?: {
    input?: UseCaseSlotExample;
    error?: UseCaseSlotExample;
  };
  successExample?: {
    input?: UseCaseSlotExample;
    result?: UseCaseSlotExample;
  };
}
