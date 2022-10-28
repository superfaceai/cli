import type { UseCaseExample } from './example/usecase-example';
import type { Model } from './models';

/** Use case details */
export interface UseCaseDetail {
  name: string;
  title?: string;
  description?: string;
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
