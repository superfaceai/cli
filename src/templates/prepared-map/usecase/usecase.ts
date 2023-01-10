import type { UseCaseExample } from './example/usecase-example';
import type { Model } from './models';

/** Use case */
export interface UseCase {
  name: string;
  title?: string;
  description?: string;
  input?: Model;
  result?: Model;
  error?: Model;
  inputExampleScalarName?: string;
  errorExamples?: {
    input?: UseCaseExample;
    error?: UseCaseExample;
  }[];
  successExamples?: {
    input?: UseCaseExample;
    result?: UseCaseExample;
  }[];
}
