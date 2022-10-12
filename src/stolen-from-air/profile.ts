import { ProfileHeader } from './header';
import { UseCase } from './usecase';
import { UseCaseDetail } from './usecase-detail';

export interface Profile {
  getProfileHeader(): ProfileHeader;
  getUseCaseList(): UseCase[];
  getUseCaseDetailList(): UseCaseDetail[];
}
