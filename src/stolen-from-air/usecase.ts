import { UseCaseBase } from './usecase-base';

/** Use case details */
export interface UseCase extends UseCaseBase {
  inputs?: string[];
  outputs?: string[];
}
