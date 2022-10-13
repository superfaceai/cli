import type { ProfileHeader } from './header';
import type { UseCase } from './usecase';
import type { UseCaseDetail } from './usecase-detail';

export interface Profile {
  getProfileHeader(): ProfileHeader;
  getUseCaseList(): UseCase[];
  getUseCaseDetailList(): UseCaseDetail[];
}
