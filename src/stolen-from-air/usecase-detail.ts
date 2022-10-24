import type { UseCaseExample } from './example/usecase-example';
import type { Model } from './models';
import type { UseCaseBase } from './usecase-base';

/** Use case details */
export interface UseCaseDetail extends UseCaseBase {
  input?: Model;
  result?: Model;
  error?: Model;
  errorExample?: {
    input?: UseCaseExample;
    error?: UseCaseExample;
  };
  successExample?: {
    input?: UseCaseExample;
    result?: UseCaseExample;
  };
}
