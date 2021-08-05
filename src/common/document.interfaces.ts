export enum DocumentType {
  UNKNOWN = 'unknown',
  MAP = 'map',
  PROFILE = 'profile',
  MAP_AST = 'map.ast',
  PROFILE_AST = 'profile.ast',
}

export interface VersionStructure {
  major: number;
  minor: number;
  patch: number;
  label?: string;
}
