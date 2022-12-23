import type { UseCaseExample } from './example/usecase-example';
import type { Model } from './models';

/** Use case */
export interface UseCase {
  name: string;
  title?: string;
  description?: string;
  method?: string;
  url?: string;
  realData?: {
    query?: Record<string, string>;
    headers?: Record<string, string>;
    body?: Model;
    // params
  };
  input?: Model;
  result?: Model;
  error?: Model;
  inputExampleScalarName?: string;
  errorExample?: {
    input?: UseCaseExample;
    error?: UseCaseExample;
  };
  successExample?: {
    input?: UseCaseExample;
    result?: UseCaseExample;
  };
}
