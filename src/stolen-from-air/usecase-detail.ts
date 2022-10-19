import type { Model } from './models';
import type { UseCaseBase } from './usecase-base';
import type { UseCaseSlotExample } from './usecase-example';

/** Use case details */
export interface UseCaseDetail extends UseCaseBase {
  input?: Model;
  result?: Model;
  error?: Model;
  errorExample?: {
    input?: UseCaseSlotExample;
    error?: UseCaseSlotExample;
  };
  successExample?: {
    input?: UseCaseSlotExample;
    result?: UseCaseSlotExample;
  };
}
