export enum CreateMode {
  PROFILE = 'profile',
  MAP = 'map',
  BOTH = 'both',
  UNKNOWN = 'unknown',
}

export interface VersionStructure {
  major: number;
  minor: number;
  patch: number;
  label?: string;
}
